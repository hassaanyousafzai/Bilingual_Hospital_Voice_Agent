"""Unified chat LLM with function calling.

Uses Gemini (Google AI Studio) when a key is present — fast, generous free limits,
one provider for brain + voice — and falls back to Groq otherwise. Exposes a small
OpenAI-shaped message object so the agents don't care which provider answered.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional

import httpx

from app.config import settings
from app.services import groq_service

logger = logging.getLogger("llm")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


# ── OpenAI-shaped normalized message ─────────────────────────────────────────
class _Fn:
    def __init__(self, name: str, arguments: str):
        self.name = name
        self.arguments = arguments


class _ToolCall:
    def __init__(self, id: str, name: str, arguments: str):
        self.id = id
        self.type = "function"
        self.function = _Fn(name, arguments)


class _Msg:
    def __init__(self, content: str, tool_calls: Optional[list] = None):
        self.content = content
        self.tool_calls = tool_calls


def llm_available() -> bool:
    return settings.active_llm_provider != "none"


def active_provider() -> str:
    return settings.active_llm_provider


# ── Gemini schema/message conversion ─────────────────────────────────────────
_TYPE_MAP = {
    "string": "STRING", "integer": "INTEGER", "number": "NUMBER",
    "boolean": "BOOLEAN", "array": "ARRAY", "object": "OBJECT",
}


def _gemini_schema(s: dict) -> dict:
    if not isinstance(s, dict):
        return {}
    out: dict[str, Any] = {}
    if "type" in s:
        out["type"] = _TYPE_MAP.get(str(s["type"]).lower(), "STRING")
    if "description" in s:
        out["description"] = s["description"]
    if "enum" in s:
        out["enum"] = s["enum"]
    if "properties" in s:
        out["properties"] = {k: _gemini_schema(v) for k, v in s["properties"].items()}
    if "required" in s:
        out["required"] = s["required"]
    if "items" in s:
        out["items"] = _gemini_schema(s["items"])
    return out


def _gemini_tools(tools: list[dict]) -> list[dict]:
    decls = []
    for t in tools:
        fn = t.get("function", t)
        params = fn.get("parameters") or {"type": "object", "properties": {}}
        decl = {"name": fn["name"], "description": fn.get("description", "")}
        schema = _gemini_schema(params)
        if schema.get("properties"):
            decl["parameters"] = schema
        decls.append(decl)
    return [{"functionDeclarations": decls}]


def _to_gemini_contents(messages: list[dict]) -> tuple[list[dict], str]:
    system_texts: list[str] = []
    contents: list[dict] = []
    for m in messages:
        role = m.get("role")
        if role == "system":
            if m.get("content"):
                system_texts.append(m["content"])
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": m.get("content", "")}]})
        elif role == "assistant":
            parts: list[dict] = []
            if m.get("content"):
                parts.append({"text": m["content"]})
            for tc in m.get("tool_calls", []) or []:
                fn = tc["function"]
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}
                parts.append({"functionCall": {"name": fn["name"], "args": args}})
            contents.append({"role": "model", "parts": parts or [{"text": ""}]})
        elif role == "tool":
            try:
                resp = json.loads(m.get("content") or "{}")
            except json.JSONDecodeError:
                resp = {"result": m.get("content")}
            if not isinstance(resp, dict):
                resp = {"result": resp}
            contents.append(
                {"role": "user", "parts": [{"functionResponse": {"name": m.get("name", "tool"), "response": resp}}]}
            )
    return contents, "\n\n".join(system_texts)


def _gemini_post(model: str, body: dict, label: str) -> Optional[dict]:
    url = GEMINI_URL.format(model=model, key=settings.gemini_api_key)
    t0 = time.perf_counter()
    try:
        r = httpx.post(url, json=body, timeout=40.0)
    except Exception as exc:
        logger.warning("[llm] gemini %s error: %s", label, exc)
        return None
    dt = time.perf_counter() - t0
    if r.status_code != 200:
        logger.warning("[llm] gemini %s HTTP %s (%.2fs): %s", label, r.status_code, dt, r.text[:200])
        return None
    logger.info("[timing] gemini %s: %.2fs", label, dt)
    return r.json()


def _gemini_chat(messages: list[dict], tools: Optional[list[dict]], temperature: float, max_tokens: int) -> Optional[_Msg]:
    contents, system = _to_gemini_contents(messages)
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
            # Disable internal "thinking" — it adds ~0.8s of latency we don't need
            # for short conversational + tool-calling turns.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if tools:
        body["tools"] = _gemini_tools(tools)
    data = _gemini_post(settings.gemini_chat_model, body, "chat")
    if not data:
        return None
    try:
        parts = data["candidates"][0]["content"]["parts"]
    except (KeyError, IndexError):
        return _Msg("", None)
    text = "".join(p["text"] for p in parts if "text" in p)
    tool_calls = []
    for i, p in enumerate(parts):
        if "functionCall" in p:
            fc = p["functionCall"]
            tool_calls.append(_ToolCall(f"call_{i}", fc.get("name", ""), json.dumps(fc.get("args") or {})))
    return _Msg(text.strip(), tool_calls or None)


# ── Public API (mirrors groq_service) ────────────────────────────────────────
def chat(messages: list[dict], tools: Optional[list[dict]] = None, temperature: float = 0.25, max_tokens: int = 800):
    if settings.active_llm_provider == "gemini":
        msg = _gemini_chat(messages, tools, temperature, max_tokens)
        if msg is not None:
            return msg
        if settings.groq_enabled:  # fall back to groq on a transient gemini error
            return groq_service.chat(messages, tools=tools, temperature=temperature, max_tokens=max_tokens)
        return None
    return groq_service.chat(messages, tools=tools, temperature=temperature, max_tokens=max_tokens)


def chat_text(messages: list[dict], temperature: float = 0.5) -> Optional[str]:
    if settings.active_llm_provider == "gemini":
        msg = _gemini_chat(messages, None, temperature, 400)
        if msg is not None:
            return msg.content or None
    return groq_service.chat_text(messages, temperature=temperature)


def chat_json(messages: list[dict], temperature: float = 0.2) -> Optional[dict]:
    if settings.active_llm_provider == "gemini":
        contents, system = _to_gemini_contents(messages)
        body: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}
        data = _gemini_post(settings.gemini_chat_model, body, "json")
        if data:
            try:
                txt = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
                return json.loads(txt)
            except (KeyError, IndexError, json.JSONDecodeError):
                pass
    return groq_service.chat_json(messages, temperature=temperature)
