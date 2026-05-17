from __future__ import annotations

from typing import Any

import modal

from .config import ModelConfig
from .image import build_image

VLLM_PORT = 8000
MINUTES = 60


def _build_vllm_cmd(config: ModelConfig) -> list[str]:
    """Build the vllm serve command from config. Returns a list suitable for subprocess."""
    m = config.model
    v = config.vllm_args

    cmd = [
        "vllm",
        "serve",
        m.name,
        "--served-model-name",
        m.served_name,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--uvicorn-log-level=info",
        "--tensor-parallel-size",
        str(config.gpu.count),
    ]

    if m.revision:
        cmd += ["--revision", m.revision]

    if v.async_scheduling:
        cmd.append("--async-scheduling")

    cmd.append("--enforce-eager" if config.scaling.fast_boot else "--no-enforce-eager")

    cmd.extend(v.extra_args)

    return cmd


def create_app(config: ModelConfig) -> tuple[modal.App, Any]:
    """
    Build and return a Modal App wired up from the given ModelConfig.

    Returns the app and the serve function so the caller can register a
    local_entrypoint against the same app if needed.
    """
    image = build_image(config)

    hf_vol = modal.Volume.from_name(config.volumes.hf_cache, create_if_missing=True)
    vllm_vol = modal.Volume.from_name(
        config.volumes.vllm_cache, create_if_missing=True
    )

    app = modal.App(config.app_name)

    # Extract primitives before the closure so the serve() function only
    # captures plain Python objects (no Pydantic models). Modal serialises
    # the closure when deploying; keeping it simple avoids import issues
    # inside the container image which doesn't have the local models/ package.
    _cmd = _build_vllm_cmd(config)
    _port = VLLM_PORT
    _scaledown = config.scaling.scaledown_window_minutes * MINUTES
    _timeout = config.scaling.timeout_minutes * MINUTES
    _gpu = f"{config.gpu.type}:{config.gpu.count}"
    _max_inputs = config.scaling.max_concurrent_inputs

    @app.function(
        image=image,
        gpu=_gpu,
        scaledown_window=_scaledown,
        timeout=_timeout,
        volumes={
            "/root/.cache/huggingface": hf_vol,
            "/root/.cache/vllm": vllm_vol,
        },
    )
    @modal.concurrent(max_inputs=_max_inputs)
    @modal.web_server(port=_port, startup_timeout=_timeout)
    def serve():
        import subprocess

        print("Starting vLLM server:", *_cmd)
        subprocess.Popen(_cmd)

    return app, serve
