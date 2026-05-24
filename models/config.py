from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import model_validator

from ._generated import (
    AuthConfig,
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
    "apply_auth_token_name",
    "AuthConfig",
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


def _slug_from_model_name(name: str) -> str:
    """e.g. 'google/gemma-4-26B-A4B-it' -> 'gemma-4-26b-a4b-it'"""
    return name.split("/")[-1].lower().replace("_", "-")


def apply_auth_token_name(config: ModelConfig, token_name: str | None) -> ModelConfig:
    """Set auth from a Modal Secret name (CLI/env). Overrides auth in YAML when set."""
    if not token_name:
        return config
    return config.model_copy(update={"auth": AuthConfig(token_name=token_name)})


class ModelConfig(ModelConfigBase):
    @model_validator(mode="after")
    def set_defaults_from_model_name(self) -> ModelConfig:
        slug = _slug_from_model_name(self.model.name)
        updates: dict = {}
        if self.app_name is None:
            updates["app_name"] = slug
        if self.model.served_name is None:
            updates["model"] = self.model.model_copy(update={"served_name": slug})
        if updates:
            return self.model_copy(update=updates)
        return self

    @classmethod
    def from_yaml(cls, path: Path) -> ModelConfig:
        with open(path) as f:
            data = yaml.safe_load(f)
        return cls.model_validate(data)
