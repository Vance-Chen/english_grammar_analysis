"""Grammar Station API — Python/FastAPI 实现。"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from starlette.responses import JSONResponse, Response, StreamingResponse

from .llm import OPENAI_API_KEY, chunk_translation, stream_llm_analysis
from .models import AnnotationBundle, TtsJobCreate, VocabularyCreate, bundle_to_jsonable
from .semantics import validate_annotation_semantics
from .throttle_cache import body_hash, cache_get, cache_set, check_throttle

log = logging.getLogger(__name__)

app = FastAPI(title="Grammar Station API (Python)")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_tts_jobs: dict[str, dict[str, Any]] = {}


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _sse_line(obj: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")


def _format_sse_error(exc: BaseException) -> str:
    """部分异常 str(e) 为空，保证 SSE 里始终有可读说明。"""
    msg = str(exc).strip()
    if msg:
        return msg[:4000]
    name = type(exc).__name__
    if getattr(exc, "args", None):
        a0 = exc.args[0]
        if isinstance(a0, str) and a0.strip():
            return f"{name}: {a0.strip()}"[:4000]
        if a0 is not None and repr(a0) != "None":
            return f"{name}: {a0!r}"[:4000]
    return f"{name}（无详细说明，请查看服务端日志）"


@app.get("/api/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/analyze")
async def analyze(request: Request) -> Response:
    ip = _client_ip(request)
    allowed, retry_after = check_throttle(ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": "too_many_requests", "retryAfterSec": retry_after},
        )

    try:
        body = await request.json()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_json", "message": str(e)},
        )

    try:
        bundle = AnnotationBundle.model_validate(body)
    except ValidationError as e:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_body", "details": e.errors(include_url=False)},
        )

    ok, errors, warnings = validate_annotation_semantics(bundle)
    if not ok:
        return JSONResponse(
            status_code=400,
            content={"error": "semantic_invalid", "errors": errors, "warnings": warnings},
        )

    cache_key = f"analyze:{body_hash(bundle_to_jsonable(bundle))}"
    cached = cache_get(cache_key)
    if cached and isinstance(cached, dict) and isinstance(cached.get("events"), list):

        async def replay() -> AsyncIterator[bytes]:
            for ev in cached["events"]:
                yield _sse_line(ev)

        return StreamingResponse(replay(), media_type="text/event-stream; charset=utf-8")

    async def gen() -> AsyncIterator[bytes]:
        events: list[dict[str, Any]] = []

        def push(ev: dict[str, Any]) -> bytes:
            events.append(ev)
            return _sse_line(ev)

        try:
            yield push({"type": "progress", "stage": "validated"})
            yield push({"type": "progress", "stage": "llm_started"})
            evaluation, translation_zh = await run_llm_analysis(bundle)
            yield push(evaluation)
            chunks = chunk_translation(translation_zh, 3)
            for i, ch in enumerate(chunks):
                yield push({"type": "translation", "delta": ch, "done": i == len(chunks) - 1})
            done_body: dict[str, Any] = {
                "type": "done",
                "full": {
                    "evaluation": evaluation,
                    "translationZh": translation_zh,
                },
            }
            if OPENAI_API_KEY:
                done_body["full"]["usage"] = {}
            yield push(done_body)
            cache_set(cache_key, {"events": events})
        except Exception as e:
            log.exception("POST /api/analyze LLM 流程失败")
            msg = _format_sse_error(e)
            yield push({"type": "error", "code": "llm_failed", "message": msg})

    return StreamingResponse(gen(), media_type="text/event-stream; charset=utf-8")


@app.post("/api/tts/jobs", status_code=202)
async def tts_create(body: TtsJobCreate) -> dict[str, Any]:
    jid = str(uuid.uuid4())
    job = {
        "id": jid,
        "sentenceHash": body.sentence_hash,
        "text": body.text,
        "voice": body.voice,
        "status": "queued",
    }
    _tts_jobs[jid] = job

    async def complete() -> None:
        await asyncio.sleep(0.1)
        j = _tts_jobs.get(jid)
        if j:
            j["status"] = "completed"

    asyncio.create_task(complete())
    return {"jobId": jid, "status": "queued"}


@app.get("/api/tts/jobs/{job_id}")
async def tts_get(job_id: str) -> Response:
    j = _tts_jobs.get(job_id)
    if not j:
        return JSONResponse(status_code=404, content={"error": "not_found"})
    return {
        **j,
        "audioUrl": None,
        "note": "生产环境应查询 audio_asset 表并返回 CDN URL",
    }


@app.post("/api/vocabulary", status_code=201)
async def vocabulary_create(body: VocabularyCreate) -> dict[str, Any]:
    vid = str(uuid.uuid4())
    return {
        "id": vid,
        "lemma": body.lemma,
        "contextSentenceId": body.context_sentence_id,
        "spanStart": body.span_start,
        "spanEnd": body.span_end,
        "note": "生产环境写入 vocabulary_item 表并触发复习调度",
    }


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8788"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
