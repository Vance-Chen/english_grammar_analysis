"""日志与对外错误信息中的敏感内容脱敏。"""

from __future__ import annotations

import re

_REDACT_PATTERNS = (
    re.compile(r"nvapi-[A-Za-z0-9_-]+"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9._-]+", re.IGNORECASE),
)


def redact_secrets(text: str) -> str:
    out = text
    for pattern in _REDACT_PATTERNS:
        out = pattern.sub("***", out)
    return out


def client_safe_message(exc: BaseException, *, public_hint: str | None = None) -> str:
    """返回可安全展示给前端用户的错误说明（不含上游原文）。"""
    raw = str(exc).strip()
    if public_hint:
        return public_hint
    if not raw:
        return type(exc).__name__
    safe = redact_secrets(raw)
    # 避免把 LLM 上游完整响应体返回给浏览器
    if "LLM HTTP" in safe or len(safe) > 280:
        return "模型服务请求失败，请稍后重试或检查服务端配置。"
    return safe[:400]
