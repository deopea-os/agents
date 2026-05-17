from __future__ import annotations

import modal

from .config import ModelConfig


def build_vllm_image(config: ModelConfig) -> modal.Image:
    img = config.image
    eng = config.engine

    image = (
        modal.Image.from_registry(img.base, add_python=img.python)
        .entrypoint([])
        .uv_pip_install(f"vllm=={eng.version}")
    )

    if eng.extra_pip:
        image = image.uv_pip_install(*eng.extra_pip)

    if img.env:
        image = image.env(img.env)

    return image


def build_image(config: ModelConfig) -> modal.Image:
    if config.engine.type == "vllm":
        return build_vllm_image(config)
    raise NotImplementedError(
        f"Engine type '{config.engine.type}' is not yet supported. "
        "Supported engines: vllm"
    )
