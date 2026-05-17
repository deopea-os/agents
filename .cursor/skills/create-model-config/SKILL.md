---
name: create-model-config
description: Create a new Modal LLM model config YAML file with validated defaults. Use when the user wants to add a new model, create a model config, deploy a new LLM, or mentions adding a model to configs/.
---

# Create Model Config

Create a new YAML config in `configs/` for deploying an LLM on Modal via vLLM.

## Required Information

Only `model.name` (Hugging Face repo ID) is truly required. Gather from the user:

1. **Model repo** -- e.g. `meta-llama/Llama-3.1-8B-Instruct`
2. **GPU preference** -- if not specified, select from the sizing guide below
3. **Any special vLLM flags** -- e.g. tool calling, reasoning, trust-remote-code

Everything else has sensible defaults defined in `models/config.py`.

## GPU Sizing Guide

Use this to pick defaults when the user doesn't specify:

| Model Size (params) | GPU Type | Count | Notes |
|---------------------|----------|-------|-------|
| < 8B               | A10G     | 1     | Cheapest option for small models |
| 8B - 14B           | A100     | 1     | Good balance of cost and speed |
| 14B - 30B          | H100     | 1     | Sufficient VRAM for most MoE and mid-size dense |
| 30B - 70B          | H200     | 1-2   | Use TP=2 for dense 70B |
| 70B+ / large MoE   | H200     | 2-4   | Or B200 for the largest models |
| 200B+ MoE          | B200     | 8     | DeepSeek V4 class models |

## Config File Naming

Use the pattern: `<model_shortname>_<size>.yaml`

Examples:
- `llama3_8b.yaml`
- `mistral_7b.yaml`
- `deepseek_v4.yaml`
- `gemma4_26b.yaml`
- `qwen2_72b.yaml`

## Creation Steps

1. Determine the Hugging Face repo ID
2. Look up the model's parameter count to select GPU defaults
3. Check if the model needs special vLLM flags (reasoning, tool calling, trust-remote-code)
4. Write the YAML file to `configs/<name>.yaml`
5. Validate by running:
   ```bash
   .venv/bin/python -c "
   from models.config import ModelConfig
   from pathlib import Path
   cfg = ModelConfig.from_yaml(Path('configs/<name>.yaml'))
   print(f'Valid: {cfg.app_name} -> {cfg.model.name} on {cfg.gpu.type}x{cfg.gpu.count}')
   "
   ```

## YAML Template

Only include sections that differ from defaults. The minimal config is:

```yaml
model:
  name: "org/model-name"
```

A typical config with customization:

```yaml
app_name: "model-shortname"

model:
  name: "org/Model-Name"
  revision: "commit-hash"
  served_name: "llm"

gpu:
  type: "H100"
  count: 1

scaling:
  scaledown_window_minutes: 15
  timeout_minutes: 10
  max_concurrent_inputs: 100
  fast_boot: false

vllm_args:
  async_scheduling: true
  extra_args:
    - "--trust-remote-code"
```

## Defaults Reference

These are applied when a field is omitted from the YAML:

| Field | Default |
|-------|---------|
| `app_name` | Slug from model name (e.g. `llama-3.1-8b-instruct`) |
| `model.served_name` | `"llm"` |
| `engine.type` | `"vllm"` |
| `engine.version` | `"0.19.0"` |
| `gpu.type` | `"H200"` |
| `gpu.count` | `1` |
| `scaling.scaledown_window_minutes` | `15` |
| `scaling.timeout_minutes` | `10` |
| `scaling.max_concurrent_inputs` | `100` |
| `scaling.fast_boot` | `false` |
| `vllm_args.async_scheduling` | `true` |
| `image.base` | `"nvidia/cuda:12.9.0-devel-ubuntu22.04"` |
| `image.python` | `"3.12"` |
| `image.env.HF_XET_HIGH_PERFORMANCE` | Not set by default (add if desired) |
| `volumes.hf_cache` | `"huggingface-cache"` (shared) |
| `volumes.vllm_cache` | `"vllm-cache"` (shared) |

## Common Extra Args Patterns

**Reasoning models** (Gemma 4, DeepSeek R1, Qwen-thinking):
```yaml
extra_args:
  - "--enable-auto-tool-choice"
  - "--reasoning-parser"
  - "<parser-name>"
  - "--tool-call-parser"
  - "<parser-name>"
```

**Text-only mode** (disable multimodal for faster loading):
```yaml
extra_args:
  - "--limit-mm-per-prompt"
  - '{"image": 0, "video": 0, "audio": 0}'
```

**Context window limiting** (reduce VRAM usage):
```yaml
extra_args:
  - "--max-model-len"
  - "8192"
```

**Community models** (not on HF transformers directly):
```yaml
extra_args:
  - "--trust-remote-code"
```

## After Creation

Tell the user how to deploy:
```bash
modal deploy main.py -- --config <name>
```

And how to test:
```bash
modal run main.py -- --config <name>
```
