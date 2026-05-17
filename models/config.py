from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator


class ModelSection(BaseModel):
    name: str
    revision: str | None = None
    served_name: str = "llm"


class EngineConfig(BaseModel):
    type: Literal["vllm"] = "vllm"
    version: str = "0.19.0"
    extra_pip: list[str] = Field(default_factory=list)


class GpuConfig(BaseModel):
    type: str = "H200"
    count: int = 1


class ScalingConfig(BaseModel):
    scaledown_window_minutes: int = 15
    timeout_minutes: int = 10
    max_concurrent_inputs: int = 100
    fast_boot: bool = False


class VllmArgsConfig(BaseModel):
    async_scheduling: bool = True
    extra_args: list[str] = Field(default_factory=list)


class ImageConfig(BaseModel):
    base: str = "nvidia/cuda:12.9.0-devel-ubuntu22.04"
    python: str = "3.12"
    env: dict[str, str] = Field(default_factory=dict)


class VolumesConfig(BaseModel):
    hf_cache: str = "huggingface-cache"
    vllm_cache: str = "vllm-cache"


class ModelConfig(BaseModel):
    app_name: str | None = None
    model: ModelSection
    engine: EngineConfig = Field(default_factory=EngineConfig)
    gpu: GpuConfig = Field(default_factory=GpuConfig)
    scaling: ScalingConfig = Field(default_factory=ScalingConfig)
    vllm_args: VllmArgsConfig = Field(default_factory=VllmArgsConfig)
    image: ImageConfig = Field(default_factory=ImageConfig)
    volumes: VolumesConfig = Field(default_factory=VolumesConfig)

    @model_validator(mode="after")
    def set_default_app_name(self) -> ModelConfig:
        if self.app_name is None:
            # e.g. "google/gemma-4-26B-A4B-it" -> "gemma-4-26b-a4b-it"
            slug = self.model.name.split("/")[-1].lower().replace("_", "-")
            self.app_name = slug
        return self

    @classmethod
    def from_yaml(cls, path: Path) -> ModelConfig:
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls.model_validate(data)
