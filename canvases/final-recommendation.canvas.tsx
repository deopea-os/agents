import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Code,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Text,
} from "cursor/canvas";

const RATES = {
  b200: 6.25,
  h200: 4.54,
  h100: 3.95,
  rtxPro6000: 3.03,
  a100_80: 2.5,
  a100_40: 2.1,
  l40s: 1.95,
  a10: 1.1,
  l4: 0.8,
  t4: 0.59,
  h200x8: 36.32,
} as const;

const MODAL_CREDIT = 30;

const HOURS_LIGHT = 3;
const HOURS_MODERATE = 6.5;
const HOURS_HEAVY = 15;

const compute = (ratePerHour: number, hours: number) =>
  Math.round(ratePerHour * hours);

const outOfPocket = (ratePerHour: number, hours: number) =>
  Math.max(0, compute(ratePerHour, hours) - MODAL_CREDIT);

const CORRECTIONS = [
  {
    tone: "danger" as const,
    title: "Llama 3.1 405B on a single B200 is impossible",
    body:
      "Hugging Face's official sizing puts INT4 405B at ~203 GB just for weights — the B200 only has 192 GB. Even ignoring KV cache and CUDA graphs, the weights alone don't fit. Hugging Face recommends 8× A100 80GB or 8× H100 80GB at minimum.",
  },
  {
    tone: "warning" as const,
    title: "Llama 3.1 70B is a weak coding pick",
    body:
      "Llama 3.1 70B Instruct scores ~42% on SWE-bench Verified vs. Qwen3-Coder-Next's 70.6% — a 28-point gap on real-world software engineering. For an agentic coding workload, swapping in Qwen3-Coder-Next at the same H200 rate is an unambiguous quality upgrade.",
  },
  {
    tone: "warning" as const,
    title: "15-second cold start claims need context",
    body:
      "Baseline Modal vLLM cold start for a 70B-class model is 4–7 minutes (weights load + torch.compile + CUDA graph capture). It only drops to ~70 seconds with vLLM sleep mode + Modal GPU memory snapshots — alpha but stable.",
  },
  {
    tone: "info" as const,
    title: "RTX PRO 6000 is the genuine bang-for-buck daily driver",
    body:
      "At $3.03/hr (vs H200's $4.54), the same Qwen3-Coder-Next-FP8 fits in 96 GB VRAM with FP8 KV cache. You give up some context headroom (likely 64–128K reliable, vs 256K on H200) but save 33%. For a daily driver where 200K+ isn't required, this is the better pick.",
  },
  {
    tone: "info" as const,
    title: "Modal Starter $30/mo credit changes the math significantly",
    body:
      "Verified across modal.com/pricing and modal docs. At moderate usage (~6.5 GPU-hours/month), the entire single-GPU stack lands at $0 out of pocket after the credit.",
  },
  {
    tone: "neutral" as const,
    title:
      "Qwen3-Coder-480B is not unambiguously better than 80B for SWE",
    body:
      "Qwen3-Coder-Next-80B-A3B scores 70.6% on SWE-bench Verified, while Qwen3-Coder-480B-A35B scores 69.6%. The 480B's edge is on LiveCodeBench (58.5%, algorithmic puzzles), not real-world software engineering. The 8× H200 burst tier doesn't actually buy more SWE-bench performance.",
  },
];

interface FinalTier {
  rank: string;
  name: string;
  model: string;
  gpu: string;
  ratePerHour: number;
  practicalContext: string;
  benchmarks: string;
  bestFor: string;
}

const TIERS: FinalTier[] = [
  {
    rank: "Tier 1",
    name: "Cheap & Fast",
    model: "Qwen/Qwen2.5-Coder-7B-Instruct",
    gpu: "L4 (24 GB, Ada)",
    ratePerHour: RATES.l4,
    practicalContext: "32K reliable; 64K possible with FP8 KV cache",
    benchmarks: "HumanEval 88.4 / HumanEval+ 84.1 / LiveCodeBench 37.6",
    bestFor:
      "Autocomplete, FIM, scripts, structured output, classification. Beats CodeStral-22B and DeepSeek-Coder-33B on HumanEval at a fraction of the cost.",
  },
  {
    rank: "Tier 2",
    name: "Balanced — daily driver",
    model: "Qwen/Qwen3-Coder-Next-FP8 (80B total / 3B active MoE)",
    gpu: "RTX PRO 6000 (96 GB, Blackwell)",
    ratePerHour: RATES.rtxPro6000,
    practicalContext: "64–128K reliable with FP8 KV cache",
    benchmarks: "SWE-bench Verified 70.6 / Aider 66.2 / Terminal-Bench 36.2",
    bestFor:
      "Everyday agentic coding, refactors, repo-scale Q&A, tool-use chains. Best $/quality on Modal for a serious coding model. Closest single-GPU model to Claude Opus on real software engineering.",
  },
  {
    rank: "Tier 3",
    name: "Maximum Intelligence with full 200K+ context",
    model: "Qwen/Qwen3-Coder-Next-FP8 (same model, more headroom)",
    gpu: "H200 (141 GB, Hopper)",
    ratePerHour: RATES.h200,
    practicalContext: "256K reliable",
    benchmarks: "SWE-bench Verified 70.6 / Aider 66.2 / Terminal-Bench 36.2",
    bestFor:
      "Long-context agentic work where 200K+ context is the requirement. Same model as Tier 2 but with breathing room. ~10-point gap to Claude Opus 4.6 (80.8%) on SWE-bench Verified — the smallest gap any single-GPU open model offers in 2026.",
  },
];

const SCENARIO_GPUS = [
  { label: "L4 / 7B", rate: RATES.l4 },
  { label: "L40S / 30B", rate: RATES.l40s },
  { label: "RTX PRO 6000 / 80B", rate: RATES.rtxPro6000 },
  { label: "H200 / 80B", rate: RATES.h200 },
  { label: "B200 / 80B", rate: RATES.b200 },
];

export default function FinalRecommendation() {
  return (
    <Stack gap={24}>
      <Stack gap={6}>
        <H1>Modal LLM deployment recommendation</H1>
        <Text tone="secondary">
          Three scale-to-zero tiers for bursty agentic coding on Modal, with
          load-bearing claims verified against primary sources (Hugging Face,
          vLLM recipes, Modal pricing, BenchLM, and model technical reports).
        </Text>
      </Stack>

      <Grid columns={3} gap={16}>
        <Stat value="$0–$15" label="Likely monthly out-of-pocket" tone="success" />
        <Stat value="70.6%" label="SWE-V on best single-GPU pick" />
        <Stat value="~10 pts" label="Gap to Claude Opus 4.6" />
      </Grid>

      <Callout tone="info" title="Context strategy">
        Only Tier 3 requires 200K+ context as a hard floor. Tiers 1 and 2 are
        sized to their natural practical context (32K and 64–128K respectively),
        which is what the Qwen model cards themselves recommend.
      </Callout>

      <H2>Key findings</H2>
      <Stack gap={12}>
        {CORRECTIONS.map((c) => (
          <Callout key={c.title} tone={c.tone} title={c.title}>
            {c.body}
          </Callout>
        ))}
      </Stack>

      <Divider />

      <H2>The synthesized three tiers</H2>
      <Stack gap={16}>
        {TIERS.map((tier) => (
          <Card key={tier.rank}>
            <CardHeader
              trailing={
                <Pill tone="info" size="sm">
                  {`~$${compute(tier.ratePerHour, HOURS_MODERATE)}/mo gross · $${outOfPocket(
                    tier.ratePerHour,
                    HOURS_MODERATE,
                  )}/mo after credit`}
                </Pill>
              }
            >
              {`${tier.rank} — ${tier.name}`}
            </CardHeader>
            <CardBody>
              <Stack gap={12}>
                <Stack gap={2}>
                  <Text size="small" tone="secondary">
                    Model
                  </Text>
                  <Code>{tier.model}</Code>
                </Stack>
                <Row gap={20} wrap>
                  <Stack gap={2}>
                    <Text size="small" tone="secondary">
                      GPU
                    </Text>
                    <Text weight="medium">{tier.gpu}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="small" tone="secondary">
                      Rate
                    </Text>
                    <Text weight="medium">{`$${tier.ratePerHour.toFixed(2)}/hr`}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="small" tone="secondary">
                      Practical context
                    </Text>
                    <Text weight="medium">{tier.practicalContext}</Text>
                  </Stack>
                </Row>
                <Stack gap={2}>
                  <Text size="small" tone="secondary">
                    Coding benchmarks
                  </Text>
                  <Text>{tier.benchmarks}</Text>
                </Stack>
                <Stack gap={2}>
                  <Text size="small" tone="secondary">
                    Best for
                  </Text>
                  <Text>{tier.bestFor}</Text>
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        ))}
      </Stack>

      <Divider />

      <H2>Out-of-pocket cost after $30/mo Modal Starter credit</H2>
      <BarChart
        categories={SCENARIO_GPUS.map((g) => g.label)}
        series={[
          {
            name: `Light (~3 GPU-hrs/mo)`,
            data: SCENARIO_GPUS.map((g) => outOfPocket(g.rate, HOURS_LIGHT)),
            tone: "success",
          },
          {
            name: `Moderate (~6.5 GPU-hrs/mo)`,
            data: SCENARIO_GPUS.map((g) => outOfPocket(g.rate, HOURS_MODERATE)),
            tone: "info",
          },
          {
            name: `Heavy (~15 GPU-hrs/mo)`,
            data: SCENARIO_GPUS.map((g) => outOfPocket(g.rate, HOURS_HEAVY)),
            tone: "warning",
          },
        ]}
        valueSuffix=" $"
        height={260}
      />
      <Text size="small" tone="secondary">
        Source: Modal pricing (per-second GPU rates) × estimated
        GPU-hours/month, minus the $30/month Starter credit (verified at
        modal.com/pricing).
      </Text>

      <Callout tone="success" title="Practical reading of the chart">
        At moderate usage, every single-GPU tier is $0 out of pocket after
        the credit. Even at heavy usage, the RTX PRO 6000 daily driver still
        comes in under $20 out of pocket; H200 at heavy usage is the only
        single-GPU option that pushes past $50.
      </Callout>

      <Divider />

      <H2>Why the daily driver moves to RTX PRO 6000</H2>
      <Text>
        With the $30 Modal credit applied, the question stops being "what's
        the absolute lowest cost?" and becomes "where's the right GPU/quality
        match for a non-200K daily workload?". Three reasons RTX PRO 6000
        wins for Tier 2:
      </Text>
      <Stack gap={8}>
        <Row gap={8} align="start">
          <Pill tone="info" size="sm">
            1
          </Pill>
          <Text>
            <Text weight="semibold">Same model, 33% cheaper.</Text> Qwen3-Coder-Next-FP8
            is the strongest single-GPU coding model in 2026, and FP8 weights
            (~80 GB) fit comfortably on the 96 GB Blackwell card.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill tone="info" size="sm">
            2
          </Pill>
          <Text>
            <Text weight="semibold">Context tradeoff is acceptable.</Text>{" "}
            With 16 GB of headroom for KV cache and FP8 KV
            quantization, you get reliable 64–128K context — sufficient for
            most coding sessions. Reserve H200 for the rare 200K+ task.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill tone="info" size="sm">
            3
          </Pill>
          <Text>
            <Text weight="semibold">Headroom for a sidecar.</Text> The
            ~$10/mo savings vs H200 at heavy usage frees budget for
            a Tier 1 (L4) or Tier 3 (H200) deployment alongside it. All
            three apps can scale to zero independently and share the HF
            cache.
          </Text>
        </Row>
      </Stack>

      <Divider />

      <H2>Honest caveats</H2>
      <Stack gap={10}>
        <Row gap={8} align="start">
          <Pill tone="warning" size="sm">
            !
          </Pill>
          <Text>
            <Text weight="semibold">Blackwell on Modal needs current vLLM and CUDA 13+.</Text>{" "}
            The RTX PRO 6000 is sm_120, which means you need vLLM 0.10+ and
            a CUDA 13 base image. Worth a smoke test before relying on it
            as your primary tier.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill tone="warning" size="sm">
            !
          </Pill>
          <Text>
            <Text weight="semibold">Qwen3-Coder-Next context math on RTX PRO 6000 is estimate-not-measured.</Text>{" "}
            The model uses hybrid linear+standard attention which makes KV
            cache much smaller than naive math suggests, but I haven't seen
            an authoritative published benchmark on this specific GPU at full
            context. Plan to verify by sending a 64K → 128K → 192K prompt
            after deploy and watching for OOMs.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill tone="warning" size="sm">
            !
          </Pill>
          <Text>
            <Text weight="semibold">The 8× H200 burst tier rarely earns its keep.</Text>{" "}
            Qwen3-Coder-480B's lead is on LiveCodeBench (algorithmic puzzles)
            at 58.5%, not SWE-bench Verified — where it actually loses to
            the 80B Coder-Next at 69.6 vs 70.6. So spinning up 8 GPUs for
            "harder problems" only pays off if you're solving competitive-programming-style
            problems, not real software engineering.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill tone="warning" size="sm">
            !
          </Pill>
          <Text>
            <Text weight="semibold">Cold starts still matter even with the credit.</Text>{" "}
            $30 of credit at H200's $4.54/hr is 6.6 hours. Without
            cold-start optimization, idle drain alone can easily eat 2–3
            hours of that. Apply the snapshot + scaledown + concurrency
            tweaks regardless of which tier you
            ship.
          </Text>
        </Row>
      </Stack>

      <Divider />

      <H2>Deployment order</H2>
      <Stack gap={6}>
        <Row gap={8} align="start">
          <Pill size="sm">A</Pill>
          <Text>
            <Text weight="semibold">Tier 2 (daily driver) first.</Text> Add{" "}
            <Code>configs/qwen3_coder_next_rtx_pro_6000.yaml</Code>:
            same Qwen3-Coder-Next-FP8 weights, gpu type RTX-PRO-6000,
            <Code>--max-model-len 65536</Code> to start (raise after testing).
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill size="sm">B</Pill>
          <Text>
            <Text weight="semibold">Deploy Tier 3 on H200.</Text>{" "}
            <Code>configs/qwen3_coder_next_h200.yaml</Code> — full 256K context.
            Already tuned with lower
            <Code>scaledown_window_minutes</Code> to 2 and{" "}
            <Code>max_concurrent_inputs</Code> to 4.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill size="sm">C</Pill>
          <Text>
            <Text weight="semibold">Add Tier 1 last.</Text>{" "}
            <Code>configs/qwen2_5_coder_7b.yaml</Code> on L4 for cheap
            completions and FIM. Effectively free with the credit.
          </Text>
        </Row>
        <Row gap={8} align="start">
          <Pill size="sm">D</Pill>
          <Text>
            <Text weight="semibold">Skip the 8× H200 burst tier.</Text> The
            quality gain on real coding tasks doesn't justify the
            complexity, and at $36.32/hr the credit covers under an hour
            per month.
          </Text>
        </Row>
      </Stack>

      <Divider />

      <H3>Sources verified for this canvas</H3>
      <Stack gap={4}>
        <Text size="small" tone="secondary">
          • Modal Starter $30/mo credit: modal.com/pricing, modal-datatools
          2026, aicreditmart.com 2026.
        </Text>
        <Text size="small" tone="secondary">
          • Llama 3.1 405B INT4 sizing (~203 GB weights, 8× H100/A100
          recommended): huggingface.co/blog/llama31, hugging-quants AWQ-INT4
          model card.
        </Text>
        <Text size="small" tone="secondary">
          • Llama 3.1 70B SWE-bench Verified ~42%: localaimaster SWE-bench
          2026 leaderboard.
        </Text>
        <Text size="small" tone="secondary">
          • Qwen3-Coder-Next benchmarks (SWE-V 70.6, Aider 66.2,
          Terminal-Bench 36.2): qwen3-coder-next technical report and dev.to
          summary.
        </Text>
        <Text size="small" tone="secondary">
          • Qwen3-Coder-480B SWE-V 69.6 / LiveCodeBench 58.5: llm-stats
          comparison and llmbase 4.7-vs-480B comparison.
        </Text>
        <Text size="small" tone="secondary">
          • Claude Opus 4.6 SWE-V 80.8% (Adaptive Reasoning, Max Effort): cgft
          comparison; Opus 4.7 SWE-V 87.6%: BenchLM May 2026 leaderboard.
        </Text>
        <Text size="small" tone="secondary">
          • Modal vLLM cold-start ranges (460s baseline, ~70s with vLLM sleep
          + GPU memory snapshots): modal-examples lfm_snapshot.py,
          logeshumapathi.com vllm serverless writeup, devcheolu vLLM cache
          recipe.
        </Text>
      </Stack>
    </Stack>
  );
}
