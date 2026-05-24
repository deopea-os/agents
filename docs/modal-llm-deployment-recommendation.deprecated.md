# Modal LLM deployment recommendation (deprecated)

> **Not recommended.** This is the original May 2026 tier plan (7B Fast / RTX Daily / H200 long-context), kept for records only.
>
> **Current recommendation:** [`modal-llm-deployment-recommendation.md`](modal-llm-deployment-recommendation.md) (Fast 30B-A3B on L40S, Daily/Max Coder-Next on H200).
>
> The interactive canvas referenced below was removed from the repo; this file is unchanged aside from this banner.

**Status:** May 2026 — load-bearing claims verified against primary sources (historical).

**Interactive view (removed):** ~~`canvases/final-recommendation.canvas.tsx`~~

---

## Executive summary

For **personal, bursty agentic coding** on Modal with a **$20–50/month** target (soft limit), deploy **three scale-to-zero tiers** that share the Hugging Face cache volume:

| Tier | Role | Model | GPU | Practical context |
|------|------|-------|-----|-------------------|
| **1** | Cheap & fast | `Qwen/Qwen2.5-Coder-7B-Instruct` | L4 (24 GB) | ~32K reliable |
| **2** | Daily driver | `Qwen/Qwen3-Coder-Next-FP8` | RTX PRO 6000 (96 GB) | ~64–128K reliable |
| **3** | Long-context | `Qwen/Qwen3-Coder-Next-FP8` (same weights) | H200 (141 GB) | ~256K reliable |

**Do not deploy** Llama 3.1 405B on a single B200 (weights alone exceed 192 GB at INT4). **Do not treat** Qwen3-Coder-480B on 8× H200 as a better *software-engineering* tier than Coder-Next 80B — SWE-bench Verified is slightly *lower* on the 480B.

With **Modal Starter’s $30/month compute credit**, light-to-moderate usage (~6.5 GPU-hours/month) keeps the single-GPU stack at **$0 out of pocket** after credit. Heavy usage (~15 GPU-hrs/mo) still keeps Tier 2 under ~$20 out of pocket; only sustained H200-as-primary exceeds $50.

**Quality vs Claude Opus:** Qwen3-Coder-Next scores **70.6%** SWE-bench Verified; Claude Opus 4.6 (Adaptive Reasoning, Max Effort) is **~80.8%** — roughly a **10-point gap** on real repo-fix tasks, the smallest gap available from any single-GPU open model in 2026.

---

## Requirements and constraints (how we got here)

### Stated goals

- **Budget:** ~$20–50/month (not hard); personal projects, not 24/7 load.
- **Quality:** As close to Claude Opus as practical for **coding** and **agentic** work.
- **Hosting:** Modal + vLLM, scale-to-zero, cold starts acceptable.
- **Concurrency:** Occasionally 2–4 parallel requests (not large batches).
- **Vision:** Nice-to-have (optional sidecar; not in the three core tiers).
- **Context:** Originally a **200K minimum** everywhere; **revised** so only **Tier 3** must guarantee 200K+. Tiers 1–2 use each model’s practical context.

### Modal billing assumptions

- GPU billed **per second** while a container runs (including idle window before scale-down).
- **Starter plan:** **$30/month free compute credit** ([Modal pricing](https://modal.com/pricing)); resets monthly, no rollover.
- Tables below use **gross** cost and **out-of-pocket** = `max(0, gross − $30)`.

---

## GPU pricing reference (Modal rates)

| GPU | VRAM | $/sec | ~$/hr | ~hrs for $50 gross |
|-----|------|-------|-------|---------------------|
| T4 | 16 GB | $0.000164 | $0.59 | 84.7 |
| L4 | 24 GB | $0.000222 | $0.80 | 62.6 |
| A10 | 24 GB | $0.000306 | $1.10 | 45.4 |
| L40S | 48 GB | $0.000542 | $1.95 | 25.6 |
| A100 40GB | 40 GB | $0.000583 | $2.10 | 23.8 |
| A100 80GB | 80 GB | $0.000694 | $2.50 | 20.0 |
| RTX PRO 6000 | 96 GB | $0.000842 | $3.03 | 16.5 |
| H100 | 80 GB | $0.001097 | $3.95 | 12.7 |
| H200 | 141 GB | $0.001261 | $4.54 | 11.0 |
| B200 | 192 GB | $0.001736 | $6.25 | 8.0 |
| 8× H200 | — | — | $36.32 | 1.4 |

Modal may **auto-upgrade** H100 → H200 at the same rate; H200! pins H100 without upgrade.

---

## Final three tiers (recommended configs)

### Tier 1 — Cheap & fast

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen2.5-Coder-7B-Instruct` |
| **GPU** | `L4` |
| **Rate** | ~$0.80/hr |
| **VRAM** | ~14 GB BF16 weights; ample KV headroom |
| **Context** | 128K native; **32K reliable** for daily use |
| **Deploy name** | `qwen2_5_coder_7b` ([`configs/qwen2_5_coder_7b.yaml`](../configs/qwen2_5_coder_7b.yaml)) |
| **OpenAI model id** | `coder-fast` (`served_name` in config — use this in VS Code / Copilot BYOK) |
| **Tool calling** | `--tool-call-parser qwen2_5_coder` + vendored plugin/chat template ([hanXen/vllm-qwen2.5-coder-tool-parser](https://github.com/hanXen/vllm-qwen2.5-coder-tool-parser), pinned under `models/vendor/qwen2_5_coder/`). Do **not** use `hermes` on Qwen2.5-Coder. |

**Best for:** Autocomplete, fill-in-the-middle, scripts, structured JSON, quick edits, lightweight Copilot/agent tool use.

**Gross @ 6.5 GPU-hrs/mo:** ~$5 · **After $30 credit:** $0

---

### Tier 2 — Balanced daily driver (primary)

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen3-Coder-Next-FP8` |
| **GPU** | `RTX-PRO-6000` (or `RTX PRO 6000` per Modal GPU string) |
| **Rate** | ~$3.03/hr |
| **VRAM** | ~80 GB FP8 weights + KV on 96 GB |
| **Context** | 262K native; **64–128K reliable** (verify after deploy) |
| **Deploy name** | `qwen3_coder_next_rtx_pro_6000` ([`configs/qwen3_coder_next_rtx_pro_6000.yaml`](../configs/qwen3_coder_next_rtx_pro_6000.yaml)) |

**Best for:** Everyday agentic coding, refactors, repo Q&A, tool-use chains — best **$/quality** when 200K is not required.

**Gross @ 6.5 GPU-hrs/mo:** ~$20 · **After credit:** $0  
**Gross @ 15 GPU-hrs/mo (heavy):** ~$45 · **After credit:** ~$15

**Why not L40S + 30B?** Qwen3-Coder-30B-A3B is strong but **strictly below** Coder-Next on SWE-bench Verified while costing similar wall-clock on a cheaper GPU — worse intelligence per dollar for agentic coding.

**Why not H200 here?** Same model on H200 costs **33% more** for context you rarely need on median sessions. Use H200 only as Tier 3.

---

### Tier 3 — Maximum context (200K+)

| Field | Value |
|-------|--------|
| **Model** | `Qwen/Qwen3-Coder-Next-FP8` (same checkpoint as Tier 2) |
| **GPU** | `H200` |
| **Rate** | ~$4.54/hr |
| **VRAM** | ~80 GB weights + **~60 GB** headroom for full KV at 256K |
| **Context** | **256K reliable** |
| **Deploy name** | `qwen3_coder_next_h200` ([`configs/qwen3_coder_next_h200.yaml`](../configs/qwen3_coder_next_h200.yaml)) |

**Best for:** Single-shot analysis of very large codebases, long agent trajectories, 200K+ prompts.

**Gross @ 6.5 GPU-hrs/mo:** ~$30 · **After credit:** $0  
**Gross @ 15 GPU-hrs/mo:** ~$68 · **After credit:** ~$38 (only tier that can exceed $50 at heavy sustained use)

**Suggested tweaks to existing config:**

```yaml
scaling:
  scaledown_window_minutes: 2   # was 5 — bursty sessions
  max_concurrent_inputs: 4      # was 100 — you run 2–4 parallel max

vllm_args:
  extra_args:
    - "--max-model-len"
    - "262144"   # or keep 131072 until snapshot/cold-start stable
```

---

## Expanded benchmark comparison

Scores are **Pass@1 / resolve rate** unless noted. Harness and scaffold matter (e.g. SWE-Agent for Qwen3-Coder-Next). Use for **relative** ranking, not absolute guarantees.

| Model | SWE-bench Verified | SWE-bench Pro | LiveCodeBench | HumanEval | HumanEval+ | Aider | Terminal-Bench 2.0 | Notes |
|-------|-------------------|---------------|---------------|-----------|------------|-------|-------------------|--------|
| **Claude Opus 4.7** (Adaptive, Max) | ~87.6% | — | — | — | — | — | — | BenchLM May 2026 |
| **Claude Opus 4.6** (Adaptive, Max) | ~80.8% | — | — | — | — | — | — | cgft comparison |
| **Claude Opus 4** | 72.5% | — | — | — | — | — | — | llm-stats vs Qwen 480B |
| **Qwen3-Coder-Next-FP8** (80B / 3B active) | **70.6%** | 44.3% | ~60% | — | — | 66.2% | 36.2% | Best single-GPU coding pick |
| **Qwen3-Coder-480B-A35B-Instruct** | 69.6% | — | **58.5%** | — | — | 61.8% | — | Needs 8× H200; better on puzzles than SWE-V |
| **Qwen3-Coder-30B-A3B-Instruct** | — | — | 40.3% | — | — | — | — | Good mid tier; below Next on SWE |
| **Qwen2.5-Coder-32B-Instruct** | — | — | 29.5% | — | — | 73.7 (whole) | — | Older SOTA open coder |
| **Qwen2.5-Coder-7B-Instruct** | — | — | **37.6%** | **88.4%** | **84.1%** | — | — | Tier 1; strong HumanEval |
| **Llama 3.1 70B Instruct** | ~42% | — | 23.2% | ~80.5% | — | — | — | Weak vs Qwen for agentic SWE |
| **Llama 3.1 405B Instruct (INT4)** | — | — | — | — | — | — | — | **Does not fit** single B200 |

**Reading the table:**

- **Agentic repo work:** Prioritize **SWE-bench Verified** → Qwen3-Coder-Next on one GPU.
- **LeetCode-style generation:** LiveCodeBench favors **480B**, not worth 8× GPU cost at this budget.
- **Small fast completions:** Tier 1 wins on **HumanEval** and cost, not SWE-bench.

---

## Monthly cost scenarios (after $30 credit)

Estimated **GPU-hours/month** (inference + cold starts + scaledown idle):

| Scenario | GPU-hrs/mo | Tier 1 (L4) | Tier 2 (RTX PRO 6000) | Tier 3 (H200) |
|----------|------------|-------------|------------------------|---------------|
| Light | 3 | $0 | $0 | $0 |
| Moderate | 6.5 | $0 | $0 | $0 |
| Heavy | 15 | $0 | ~$15 | ~$38 |

Running **all three tiers** at moderate pace (rarely all warm at once): gross ~$55, out-of-pocket ~$25 if each sees ~6.5 hrs — still plausible inside a soft $50 cap if only one tier is warm per session.

---

## Cold-start and idle-cost tuning

Cold starts and **scaledown idle** dominate spend at low monthly GPU-hours. Apply regardless of tier.

### 1. Shorten scaledown window (high impact)

For bursty use (clusters of requests within an hour), **`scaledown_window_minutes: 2`** (from 5) keeps one container warm through a session without paying for long idle gaps between days.

### 2. Modal GPU memory snapshots (high impact, alpha)

vLLM **sleep mode** + Modal **`enable_memory_snapshot=True`** and **`experimental_options={"enable_gpu_snapshot": true}`** can cut cold starts from **~460s → ~70s** on large models (community benchmark on A100-80GB; see [Modal memory snapshots](https://modal.com/docs/guide/memory-snapshots) and [modal-examples `lfm_snapshot.py`](../modal-examples/06_gpu_and_ml/llm-serving/lfm_snapshot.py)).

Pattern:

- `@modal.enter(snap=True)` — start vLLM, warmup, put server to sleep, then snapshot.
- `@modal.enter(snap=False)` — wake vLLM after restore.

Weight download time is **not** eliminated by snapshots (HF cache on Modal Volume still helps).

### 3. Right-size concurrency

Set **`max_concurrent_inputs: 4`** (from 100) when you only run 2–4 parallel requests — frees KV budget for longer contexts.

### 4. `fast_boot` vs throughput

- **`fast_boot: true`** — faster cold start, lower sustained tok/s (good for experimentation).
- **`fast_boot: false`** — production throughput; pair with snapshots rather than leaving containers warm 24/7.

### 5. HF + vLLM caches

Shared volumes (already in project defaults):

- `huggingface-cache` — avoids re-downloading weights.
- `vllm-cache` — JIT / compilation cache for faster warm starts after first boot.

---

## What to ship (action list)

| Step | Action |
|------|--------|
| A | `configs/qwen3_coder_next_rtx_pro_6000.yaml` — Tier 2 daily driver |
| B | `configs/qwen3_coder_next_h200.yaml` — Tier 3 long context |
| C | `configs/qwen2_5_coder_7b.yaml` — Tier 1 on L4 |
| D | **Skip** 8× H200 / Qwen3-Coder-480B for this budget and workload |
| E | Optional: implement GPU snapshot path in `main.py` / `server.py` when ready (see Modal examples) |

Deploy:

```bash
modalstack deploy qwen3_coder_next_rtx_pro_6000   # Tier 2 — daily driver
modalstack deploy qwen3_coder_next_h200           # Tier 3 — 256K context
modalstack deploy qwen2_5_coder_7b                # Tier 1 — cheap & fast
```

---

## Caveats and open verification

| Topic | Risk | Mitigation |
|-------|------|------------|
| **RTX PRO 6000 + Blackwell** | Needs recent vLLM + CUDA 13+ (`sm_120`) | Smoke-test deploy before making Tier 2 primary |
| **Context on 96 GB** | 64–128K is **estimated**, not measured on this stack | Ramp `--max-model-len` 64K → 128K → 192K; watch OOM |
| **Benchmark harness** | SWE scores use agent scaffolds | Expect lower raw model-only performance |
| **Qwen2.5-Coder + Copilot** | Hermes parser emits `tool_calls: []` on text streams | Use `qwen2_5_coder` parser (vendored); health check rejects empty `tool_calls` |
| **Modal credit** | $30/mo, no rollover | Monitor Usage & Billing if usage ramps |
| **Opus gap** | ~10 pts SWE-V vs Opus 4.6 | Use hosted Opus for hardest tasks; self-host for volume/cost |

---

## Optional: vision sidecar (not in core three tiers)

If screenshot/UI understanding is needed from **your own clients** (not Cursor BYOK):

- **Model:** `Qwen/Qwen3-VL-30B-A3B-Instruct-FP8`
- **GPU:** L40S or H100
- **Note:** Separate deployment; no single-GPU model is both top-tier coder and vision in 2026.

---

## Sources

| Claim | Source |
|-------|--------|
| Modal $30/mo Starter credit | https://modal.com/pricing , https://modal.com/docs/guide/billing |
| Llama 3.1 VRAM table (405B INT4 = 203 GB) | https://huggingface.co/blog/llama31 |
| Qwen3-Coder-Next benchmarks | Qwen3-Coder-Next technical report; https://huggingface.co/Qwen/Qwen3-Coder-Next-FP8 |
| Qwen2.5-Coder-7B LCB / HumanEval | Qwen2.5-Coder technical report (arXiv:2409.12186) |
| Qwen3-Coder-480B vs Opus SWE-V | https://llm-stats.com/models/compare/claude-opus-4-20250514-vs-qwen3-coder-480b-a35b-instruct |
| Opus 4.6 SWE-V 80.8% | https://cgft.io/compare/qwen3-5-397b-vs-claude-opus-4-6/ |
| Cold-start ~70s with snapshots | https://logeshumapathi.com/blog/2026/05/17/vllm-serverless.html ; Modal docs |
| vLLM Qwen3-Coder-480B 8× H200 | https://docs.vllm.ai/projects/recipes/en/stable/Qwen/Qwen3-Coder-480B-A35B.html |

---

*Last updated: May 2026. Revisit when Modal GPU pricing, vLLM versions, or Qwen checkpoint releases change materially.*
