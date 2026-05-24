from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import model_validator

from ._generated import (
    EngineConfig,
    EngineType,
    GpuConfig,
    ImageConfig,
    ModelConfigBase,
    ModelSection,
    ScalingConfig,
    VllmArgsConfig,
    VolumesConfig,
)

__all__ = [
    "EngineConfig",
    "EngineType",
    "GpuConfig",
    "ImageConfig",
    "ModelConfig",
    "ModelSection",
    "ScalingConfig",
    "VllmArgsConfig",
    "VolumesConfig",
]


class ModelConfig(ModelConfigBase):
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
