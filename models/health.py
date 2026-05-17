from __future__ import annotations

import json
from typing import Any

import aiohttp
import modal

from .config import ModelConfig

MINUTES = 60


def register_health_check(
    app: modal.App, serve_fn: Any, config: ModelConfig
) -> None:
    """Register a local_entrypoint on app that health-checks the deployed server."""
    _served_name = config.model.served_name
    _timeout_s = config.scaling.timeout_minutes * MINUTES

    @app.local_entrypoint()
    async def test():
        url = await serve_fn.get_web_url.aio()

        async with aiohttp.ClientSession(base_url=url) as session:
            print(f"Health check: {url}/health")
            async with session.get(
                "/health",
                timeout=aiohttp.ClientTimeout(total=_timeout_s),
            ) as resp:
                assert resp.status == 200, f"Health check failed with status {resp.status}"
            print("Health check passed.")

            messages = [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Say hello in one sentence."},
            ]
            print(f"Sending test message to model '{_served_name}' ...")
            await _send_request(session, _served_name, messages)


async def _send_request(
    session: aiohttp.ClientSession,
    model: str,
    messages: list[dict[str, Any]],
) -> None:
    payload = {"messages": messages, "model": model, "stream": True}
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
            content = delta.get("content") or delta.get("reasoning_content")
            if content:
                print(content, end="", flush=True)
    print()
