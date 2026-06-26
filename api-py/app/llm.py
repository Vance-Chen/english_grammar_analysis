from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .models import AnnotationBundle, bundle_to_jsonable

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_MODEL_TRANSLATION = os.environ.get("OPENAI_MODEL_TRANSLATION", "").strip() or OPENAI_MODEL


def _http_timeout() -> httpx.Timeout:
    read_s = float(os.environ.get("OPENAI_HTTP_READ_TIMEOUT", "600"))
    connect_s = float(os.environ.get("OPENAI_HTTP_CONNECT_TIMEOUT", "30"))
    return httpx.Timeout(connect=connect_s, read=read_s, write=read_s, pool=connect_s)


def _max_tokens(kind: str) -> int:
    if kind == "translation":
        raw = os.environ.get("OPENAI_MAX_TOKENS_TRANSLATION", "512")
    else:
        raw = os.environ.get("OPENAI_MAX_TOKENS", "2048")
    try:
        return max(256, int(raw))
    except ValueError:
        return 512 if kind == "translation" else 2048


def _temperature_fields() -> dict[str, float]:
    raw = os.environ.get("OPENAI_TEMPERATURE")
    if raw is None:
        return {"temperature": 0.3}
    s = raw.strip()
    if s == "" or s.lower() in ("omit", "none"):
        return {}
    try:
        return {"temperature": float(s)}
    except ValueError:
        return {"temperature": 0.3}


EVAL_SYSTEM = """你是英语语法教授。根据用户提交的句子及标注 JSON：
1) 评估标注：overallScore 0-100；dimensions 含 boundary_accuracy、function_form_consistency、hierarchy、sentence_pattern_match，每项 score+comment（中文）。
2) differences：issue（中文），可选 spanId、suggestion。
3) summary：中文总评。

规则：空格/标点不必单独成 span；unknown 成分重点讲解勿重罚；vp 与 V 搭配为推荐；仅输出 JSON：overallScore, dimensions, differences, summary。"""

TRANS_SYSTEM = "将用户给出的英文句子译为优雅自然的中文。只输出译文，不要解释或引号。"


def _mock_result(bundle: AnnotationBundle) -> tuple[dict[str, Any], str]:
    span_count = len(bundle.spans)
    base = min(95, 60 + span_count * 3)
    evaluation = {
        "type": "evaluation",
        "overallScore": base,
        "dimensions": [
            {"name": "boundary_accuracy", "score": base, "comment": "（离线模拟）根据 span 数量粗评。"},
            {"name": "function_form_consistency", "score": base - 2, "comment": "配置 OPENAI_API_KEY 可启用真实评估。"},
            {"name": "hierarchy", "score": base - 4, "comment": "检查 parentSpanId 与从句类型是否一致。"},
            {"name": "sentence_pattern_match", "score": base - 1, "comment": "对照句类与结构标签。"},
        ],
        "differences": [],
        "summary": "当前为离线模式：未调用大模型。请在环境变量中设置 OPENAI_API_KEY（及可选 OPENAI_BASE_URL、OPENAI_MODEL）。",
    }
    return evaluation, f"（模拟译文）{bundle.text}"


async def _chat_completion(
    *,
    model: str,
    system: str,
    user_content: str,
    json_mode: bool,
    max_tokens: int,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        **_temperature_fields(),
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    read_s = float(os.environ.get("OPENAI_HTTP_READ_TIMEOUT", "600"))
    connect_s = float(os.environ.get("OPENAI_HTTP_CONNECT_TIMEOUT", "30"))
    async with httpx.AsyncClient(timeout=_http_timeout()) as client:
        try:
            res = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json=payload,
            )
        except httpx.ReadTimeout as e:
            raise RuntimeError(
                f"LLM 响应读超时（超过 {read_s:g}s）。可调大 OPENAI_HTTP_READ_TIMEOUT，或换更快模型（如 OPENAI_MODEL_TRANSLATION）。"
            ) from e
        except httpx.ConnectTimeout as e:
            raise RuntimeError(
                f"LLM 连接超时（超过 {connect_s:g}s）。请检查 OPENAI_BASE_URL 与网络。"
            ) from e

    if not res.is_success:
        raise RuntimeError(f"LLM HTTP {res.status_code}: {res.text[:500]}")
    raw = (res.json().get("choices") or [{}])[0].get("message", {}).get("content")
    if not raw:
        raise RuntimeError("LLM 无内容返回")
    return raw.strip()


async def _fetch_evaluation(bundle: AnnotationBundle) -> dict[str, Any]:
    user_content = json.dumps(bundle_to_jsonable(bundle), ensure_ascii=False, separators=(",", ":"))
    raw = await _chat_completion(
        model=OPENAI_MODEL,
        system=EVAL_SYSTEM,
        user_content=user_content,
        json_mode=True,
        max_tokens=_max_tokens("evaluation"),
    )
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError("LLM 评估返回非 JSON") from e

    overall = max(0, min(100, int(parsed.get("overallScore", 70))))
    dimensions = parsed.get("dimensions")
    if not isinstance(dimensions, list):
        dimensions = [
            {"name": "boundary_accuracy", "score": 70, "comment": "（模型未返回维度，已占位）"},
            {"name": "function_form_consistency", "score": 70, "comment": ""},
            {"name": "hierarchy", "score": 70, "comment": ""},
            {"name": "sentence_pattern_match", "score": 70, "comment": ""},
        ]
    differences = parsed.get("differences") if isinstance(parsed.get("differences"), list) else []
    summary = parsed.get("summary") if isinstance(parsed.get("summary"), str) else ""
    return {
        "type": "evaluation",
        "overallScore": overall,
        "dimensions": dimensions,
        "differences": differences,
        "summary": summary,
    }


async def _fetch_translation(text: str) -> str:
    raw = await _chat_completion(
        model=OPENAI_MODEL_TRANSLATION,
        system=TRANS_SYSTEM,
        user_content=text,
        json_mode=False,
        max_tokens=_max_tokens("translation"),
    )
    return raw or "（未返回译文）"


async def stream_llm_analysis(bundle: AnnotationBundle) -> AsyncIterator[tuple[str, Any]]:
    """并行请求评估与译文；先完成的先 yield（evaluation | translation）。"""
    if not OPENAI_API_KEY:
        evaluation, translation_zh = _mock_result(bundle)
        yield "evaluation", evaluation
        yield "translation", translation_zh
        return

    eval_task = asyncio.create_task(_fetch_evaluation(bundle))
    trans_task = asyncio.create_task(_fetch_translation(bundle.text))
    pending = {eval_task, trans_task}
    try:
        while pending:
            done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                if task is eval_task:
                    yield "evaluation", task.result()
                else:
                    yield "translation", task.result()
    except Exception:
        for task in (eval_task, trans_task):
            if not task.done():
                task.cancel()
        raise


async def run_llm_analysis(bundle: AnnotationBundle) -> tuple[dict[str, Any], str]:
    """兼容旧调用：等待全部完成后返回。"""
    evaluation: dict[str, Any] | None = None
    translation_zh = ""
    async for kind, data in stream_llm_analysis(bundle):
        if kind == "evaluation":
            evaluation = data
        else:
            translation_zh = data
    if evaluation is None:
        raise RuntimeError("LLM 未返回评估结果")
    return evaluation, translation_zh


def chunk_translation(zh: str, chunk_size: int = 3) -> list[str]:
    return [zh[i : i + chunk_size] for i in range(0, len(zh), chunk_size)]
