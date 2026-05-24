# Modal LLM deployment recommendation

**Status:** May 2026 — revised after production feedback on Tier 1 (7B / 32K) and context needs for Copilot / Claude Code agents.

**Previous plan (deprecated):** [`modal-llm-deployment-recommendation.md.deprecated`](modal-llm-deployment-recommendation.md.deprecated) — original 7B / RTX / long-context tier write-up, kept for records only.

---

## Executive summary

For **personal, bursty agentic coding** on Modal with a **$20–50/month** target (soft limit), deploy **three scale-to-zero tiers** that share the Hugging Face cache volume:

| Tier | Role | Model | GPU | `--max-model-len` | OpenAI `model` id |
|------|------|-------|-----|-------------------|-------------------|
| **1 — Fast** | Speed + 128K agentic | `Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8` | L40S (48 GB) | 131072 | `coder-fast` |
| **2 — Daily** | Workhorse 200K | `Qwen/Qwen3-Coder-Next-FP8` | H200 (141 GB) | 200000 | `coder-daily` |
| **3 — Max** | Max context + peak open coding | `Qwen/Qwen3-Coder-Next-FP8` | H200 (141 GB) | 262144 | `coder-max` |

**Why this changed:** Tier 1 at 32K on Qwen2.5-Coder-7B ran out of context immediately for agentic clients, showed weak reasoning, and had awkward tool-calling. Fast is now **speed-first** (smaller active MoE, L40S) with **128K** served context. Daily and Max both use **Coder-Next** on **H200** with different context ceilings — Daily for routine 200K work, Max for full 256K native window.

**Do not deploy** Llama 3.1 405B on a single B200 (weights alone exceed 192 GB at INT4). **Do not treat** Qwen3-Coder-480B on 8× H200 as better *software-engineering* tier than Coder-Next — SWE-bench Verified is slightly *lower* on 480B (~64.7% vs **70.6%**). **DeepSeek-V4-Pro-Max** and **MiniMax-M2.7** need **4–8 GPUs** and do not fit this single-GPU, scale-to-zero stack (see comparison notes below).

**Quality vs Claude Opus:** Qwen3-Coder-Next scores **70.6%** SWE-bench Verified; Claude Opus 4.6 is **~80.8%** — roughly a **10-point gap** on repo-fix tasks. That remains the best evidenced **single-GPU** open coding option in 2026.

---

## Requirements and constraints

### Stated goals

- **Budget:** ~$20–50/month (soft); personal, bursty use.
- **Quality:** Strong agentic coding; minimize tool/parser friction with Copilot / Claude Code–style clients.
- **Hosting:** Modal + vLLM, scale-to-zero, cold starts acceptable.
- **Concurrency:** 2–4 parallel requests.
- **Context:** **≥128K** for agentic clients on Fast; **200K** on Daily; **250K+** on Max.

### Production feedback (May 2026)

| Prior tier | Issue | Response |
|------------|-------|----------|
| Fast: 7B @ 32K | Context exhausted immediately; low intelligence; tool incompatibility | **New model:** Qwen3-Coder-30B-A3B-FP8; **131072** `max-model-len`; **L40S** for speed |
| Daily: Coder-Next @ 65K on RTX | Felt weak (likely context-limited) | **Same model**, **200000** on **H200** |
| Long-context tier | Want “Max” naming + max intelligence | **coder-max** @ **262144** on H200 |

### Modal billing

- GPU billed per second while the container runs (including scaledown idle).
- **Starter:** **$30/month** compute credit ([Modal pricing](https://modal.com/pricing)).
- **Out-of-pocket** = `max(0, gross − $30)`.

---

## GPU pricing reference (Modal)

| GPU | VRAM | ~$/hr | Deploy config |
|-----|------|-------|---------------|
| L4 | 24 GB | $0.80 | *(retired for Fast tier)* |
| **L40S** | 48 GB | **$1.95** | Fast |
| RTX PRO 6000 | 96 GB | $3.03 | *(retired — Daily moved to H200 for 200K)* |
| **H200** | 141 GB | **$4.54** | Daily + Max |

---

## Tier details

### Tier 1 — Fast (`coder-fast`)

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8` |
| **GPU** | `L40S` |
| **Active params** | ~3.3B (30.5B MoE total) |
| **Context** | 256K native; serve **131072** for Copilot/agent headroom |
| **SWE-bench Verified** | **51.9%** Pass@1 (OpenHands; vendor/Nebius) — below Coder-Next, far above 7B tier |
| **Config** | [`configs/qwen3_coder_30b_a3b_l40s.yaml`](../configs/qwen3_coder_30b_a3b_l40s.yaml) |
| **vLLM** | `--tool-call-parser qwen3_coder` (same family as Daily/Max) |

**Best for:** Fast agent turns, shorter tasks, when Daily/Max are cold. Prioritize **wall-clock speed** over lowest $/hr (L40S vs L4).

**Copilot token budget (approx.):** max input ~98304, max output ~32768 (if client splits 75/25 within 131072).

---

### Tier 2 — Daily (`coder-daily`)

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen3-Coder-Next-FP8` |
| **GPU** | `H200` |
| **Context** | **`--max-model-len` 200000** |
| **SWE-bench Verified** | **70.6%** |
| **Config** | [`configs/qwen3_coder_next_h200_daily.yaml`](../configs/qwen3_coder_next_h200_daily.yaml) |

**Best for:** Primary agentic coding sessions at 200K context.

**Why H200 (not RTX PRO 6000):** Vendor warns OOM at long context on smaller VRAM; 200K KV + ~80 GB FP8 weights is safer on 141 GB H200 with `max_concurrent_inputs: 4`.

**Copilot token budget (approx.):** max input ~150000, max output ~32768.

---

### Tier 3 — Max (`coder-max`)

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen3-Coder-Next-FP8` (same weights as Daily) |
| **GPU** | `H200` |
| **Context** | **`--max-model-len` 262144** (256K native) |
| **Config** | [`configs/qwen3_coder_next_h200.yaml`](../configs/qwen3_coder_next_h200.yaml) |

**Best for:** Very large repos, long single-shot trajectories, maximum context.

**Intelligence vs “bigger” models:** On SWE-bench Verified, Coder-Next beats Qwen3-Coder-480B on 8× GPU and matches or beats DeepSeek-V3.2 (~70%) on published cards — **Max is max context on the best evidenced single-GPU open coder**, not a separate weight class.

**Copilot token budget (approx.):** max input ~229376, max output ~32768.

---

## Frontier alternatives (not in this stack)

| Model | SWE-bench Verified (evidence) | Modal fit |
|-------|------------------------------|-----------|
| **DeepSeek-V4-Pro-Max** | **80.6%** (HF / Steel) | **8× B200** (~$50/hr); `deepseek_v4` parsers |
| **MiniMax-M2.5** | **80.2%** (vendor; Claude Code scaffold) | **4× ~96 GB GPU**; 196K max per sequence |
| **MiniMax-M2.7** | SWE-**Pro** 56.2% (not Verified on card) | Same 4× GPU pattern; **196K** cap |

Use hosted APIs or a separate multi-GPU deployment if you need these scores; they are out of scope for the three-tier scale-to-zero design.

---

## Monthly cost scenarios (after $30 credit)

Illustrative **GPU-hours/month** (one tier warm at a time):

| Scenario | GPU-hrs/mo | Fast (L40S) | Daily (H200) | Max (H200) |
|----------|------------|-------------|--------------|--------------|
| Light | 3 | $0 | $0 | $0 |
| Moderate | 6.5 | $0 | $0 | $0 |
| Heavy (one tier) | 15 | ~$0 | ~$38 | ~$38 |

Running **Daily and Max** on separate apps both using H200: you only pay for the app that is scaled up; keep **one H200 deployment warm per session**.

---

## Deploy

```bash
modalstack deploy qwen3_coder_30b_a3b_l40s      # Tier 1 — Fast
modalstack deploy qwen3_coder_next_h200_daily   # Tier 2 — Daily (200K)
modalstack deploy qwen3_coder_next_h200         # Tier 3 — Max (256K)

modalstack run qwen3_coder_30b_a3b_l40s         # health check
```

Point Copilot BYOK / gateway at the Modal URL; use **`coder-fast`**, **`coder-daily`**, or **`coder-max`** as the OpenAI `model` field (`served_name` in each config).

---

## Cold-start and ops tuning

Shared across tiers (already in configs):

- `scaledown_window_minutes: 2`
- `max_concurrent_inputs: 4`
- `--enable-prefix-caching` where supported

Optional later: Modal GPU memory snapshots + vLLM sleep mode ([Modal memory snapshots](https://modal.com/docs/guide/memory-snapshots)).

---

## Caveats

| Topic | Risk | Mitigation |
|-------|------|------------|
| **200K / 262K on H200** | OOM if concurrency + context too high | Smoke-test; lower `max_concurrent_inputs` |
| **L40S + 30B FP8** | First deploy may need vLLM/CUDA smoke test | `modalstack run qwen3_coder_30b_a3b_l40s` |
| **Two H200 apps** | Same GPU list, separate Modal apps | Deploy both; only one active per session |
| **Claude Code** | Needs Anthropic API or proxy | OpenAI-compatible Modal URL is not enough alone |
| **Benchmark harness** | SWE scores use agent scaffolds | Expect gap vs IDE experience |

---

## Retired configs

| Removed | Reason |
|---------|--------|
| `qwen2_5_coder_7b.yaml` | Replaced by `qwen3_coder_30b_a3b_l40s.yaml` |
| `qwen3_coder_next_rtx_pro_6000.yaml` | Daily moved to H200 @ 200K |
| `models/vendor/qwen2_5_coder/` | Removed — Qwen2.5-Coder used a vendored tool parser; stack uses built-in `qwen3_coder` |

---

## Sources

| Claim | Source |
|-------|--------|
| Modal pricing / $30 credit | https://modal.com/pricing |
| Qwen3-Coder-Next 70.6% SWE-V, 256K | https://huggingface.co/Qwen/Qwen3-Coder-Next-FP8 |
| Qwen3-Coder-30B-A3B 256K, agentic | https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct |
| 30B SWE 51.9% | https://nebius.com/blog/posts/openhands-trajectories-with-qwen3-coder-480b |
| DeepSeek-V4-Pro 80.6% | https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro |
| vLLM `qwen3_coder` parser | https://github.com/vllm-project/recipes |

---

*Last updated: May 2026.*
