from __future__ import annotations

import json
from typing import Any

import aiohttp

MINUTES = 60


async def run_health_check(
    serve_fn: Any,
    served_name: str,
    timeout_s: float,
    *,
    api_key: str | None = None,
    reject_empty_tool_calls: bool = False,
) -> None:
    """Health-check a deployed serve function and send one test message."""
    url = await serve_fn.get_web_url.aio()
    auth_headers = (
        {"Authorization": f"Bearer {api_key}"} if api_key else {}
    )

    async with aiohttp.ClientSession(base_url=url, headers=auth_headers) as session:
        print(f"Health check: {url}/health")
        async with session.get(
            "/health",
            timeout=aiohttp.ClientTimeout(total=timeout_s),
        ) as resp:
            assert resp.status == 200, f"Health check failed with status {resp.status}"
        print("Health check passed.")

        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello in one sentence."},
        ]
        print(f"Sending test message to model '{served_name}' ...")
        await _send_request(session, served_name, messages)

        if reject_empty_tool_calls:
            print("Copilot-compat stream check (tools enabled) ...")
            await _send_request(
                session,
                served_name,
                messages,
                tools=[{"type": "function", "function": {"name": "noop", "description": "No-op", "parameters": {"type": "object", "properties": {}}}}],
                reject_empty_tool_calls=True,
            )


async def _send_request(
    session: aiohttp.ClientSession,
    model: str,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    reject_empty_tool_calls: bool = False,
) -> None:
    payload: dict[str, Any] = {"messages": messages, "model": model, "stream": True}
    if tools is not None:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}

    async with session.post(
        "/v1/chat/completions", json=payload, headers=headers
    ) as resp:
        resp.raise_for_status()
        async for raw in resp.content:
            line = raw.decode().strip()
            if not line or line == "data: [DONE]":
                continue
            if line.startswith("data: "):
                line = line[len("data: "):]
            chunk = json.loads(line)
            delta = chunk["choices"][0]["delta"]
            if reject_empty_tool_calls and delta.get("tool_calls") == []:
                raise AssertionError(
                    "stream delta contained tool_calls: [] (breaks Copilot); "
                    "use qwen2_5_coder tool-call-parser (not hermes)"
                )
            content = delta.get("content") or delta.get("reasoning_content")
            if content:
                print(content, end="", flush=True)
    print()
