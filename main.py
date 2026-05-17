# Modal LLM serving entrypoint.
#
# Select a model config with --config <name> (resolves to configs/<name>.yaml)
# or the MODEL_CONFIG environment variable.
#
# Deploy:
#   modal deploy main.py -- --config gemma4_26b
#   MODEL_CONFIG=gemma4_26b modal deploy main.py
#
# Test (spins up a fresh replica locally):
#   modal run main.py -- --config gemma4_26b

import argparse
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve the config name at import time so both `modal deploy` and
# `modal run` work. Modal passes everything after `--` into sys.argv.
# ---------------------------------------------------------------------------
_parser = argparse.ArgumentParser(add_help=False)
_parser.add_argument("--config", default=None, metavar="NAME")
_known, _ = _parser.parse_known_args()

_config_name: str | None = os.environ.get("MODEL_CONFIG") or _known.config

if _config_name is None:
    print(
        "No model config specified.\n"
        "  Pass --config: modal deploy main.py -- --config gemma4_26b\n"
        "  Or set env var: MODEL_CONFIG=gemma4_26b modal deploy main.py",
        file=sys.stderr,
    )
    sys.exit(1)

_configs_dir = Path(__file__).parent / "configs"
_config_path = _configs_dir / f"{_config_name}.yaml"

if not _config_path.exists():
    available = sorted(p.stem for p in _configs_dir.glob("*.yaml") if not p.stem.startswith("_"))
    print(
        f"Config '{_config_name}' not found at {_config_path}\n"
        f"Available configs: {', '.join(available) or '(none)'}",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Load config and wire up the Modal app.
# ---------------------------------------------------------------------------
from models.config import ModelConfig
from models.health import register_health_check
from models.server import create_app

config = ModelConfig.from_yaml(_config_path)
app, serve = create_app(config)
register_health_check(app, serve, config)
