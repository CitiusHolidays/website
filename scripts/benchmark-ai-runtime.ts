import { AI_MODEL_SELECTION_EVIDENCE, AI_RUNTIME_POLICIES } from "../src/lib/ai/runtimePolicy";

interface BenchmarkSample {
  expectedHeadings?: string[];
  expectedTool?: string;
  feature: "concierge" | "journeyPlanner";
  name: string;
  prompt: string;
  system: string;
  tools?: unknown[];
}

const destinationTool = {
  function: {
    description: "Search Citius destination and service fit before answering.",
    name: "searchCitiusOfferings",
    parameters: {
      additionalProperties: false,
      properties: {
        category: { enum: ["mice", "international", "domestic"], type: "string" },
        query: { type: "string" },
      },
      required: ["category", "query"],
      type: "object",
    },
  },
  type: "function",
};

export const AI_BENCHMARK_PROMPTS: BenchmarkSample[] = [
  {
    expectedTool: "searchCitiusOfferings",
    feature: "concierge",
    name: "mice-destination-tool",
    prompt: "Shortlist two premium destinations near India for an 80-person Q4 leadership retreat.",
    system:
      "You are the concise Citius Holidays Concierge. Call searchCitiusOfferings before answering destination questions.",
    tools: [destinationTool],
  },
  {
    expectedTool: "searchCitiusOfferings",
    feature: "concierge",
    name: "domestic-offsite-tool",
    prompt: "What should Citius handle for a 120-person three-night corporate offsite in Goa?",
    system:
      "You are the concise Citius Holidays Concierge. Call searchCitiusOfferings before answering service questions.",
    tools: [destinationTool],
  },
  {
    expectedHeadings: [
      "## Recommended journey",
      "## Best season & duration",
      "## Suggested itinerary (day-by-day)",
      "## Soul score opportunity",
    ],
    feature: "journeyPlanner",
    name: "kashi-itinerary",
    prompt: "Plan a 3-day pilgrimage to Kashi Vishwanath for a traveler arriving from Kolkata.",
    system:
      "Return concise, respectful pilgrimage guidance with these exact markdown headings: ## Recommended journey; ## Best season & duration; ## Suggested itinerary (day-by-day); ## Soul score opportunity. Do not invent prices or guaranteed darshan slots.",
  },
  {
    expectedHeadings: [
      "## Recommended journey",
      "## Best season & duration",
      "## Suggested itinerary (day-by-day)",
      "## Soul score opportunity",
    ],
    feature: "journeyPlanner",
    name: "southern-trail-itinerary",
    prompt: "Plan a practical 4-day Madurai and Rameswaram sacred journey from Bengaluru.",
    system:
      "Return concise, respectful pilgrimage guidance with these exact markdown headings: ## Recommended journey; ## Best season & duration; ## Suggested itinerary (day-by-day); ## Soul score opportunity. Do not invent prices or guaranteed darshan slots.",
  },
];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The benchmark keeps one streaming probe self-contained so timing and quality state share one clock.
async function probeModel(
  openRouterApiKey: string,
  model: string,
  sample: BenchmarkSample,
  timeoutMs: number
) {
  const startedAt = performance.now();
  let firstPartAt: number | undefined;
  let content = "";
  let finishReason: string | undefined;
  let outputTokens: number | undefined;
  const toolNames = new Set<string>();
  let status = 0;
  let error: string | undefined;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      body: JSON.stringify({
        max_tokens: 900,
        messages: [
          { content: sample.system, role: "system" },
          { content: sample.prompt, role: "user" },
        ],
        model,
        provider: { require_parameters: Boolean(sample.tools) },
        stream: true,
        stream_options: { include_usage: true },
        temperature: 0.2,
        tool_choice: sample.tools ? "auto" : undefined,
        tools: sample.tools,
      }),
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://citiusholidays.com",
        "X-Title": "Citius AI Runtime Benchmark",
      },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const { status: responseStatus } = response;
    status = responseStatus;
    if (!(response.ok && response.body)) {
      throw new Error((await response.text()).slice(0, 300));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: A ReadableStream must be consumed in sequence.
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!(line.startsWith("data: ") && line !== "data: [DONE]")) {
          continue;
        }
        const payload = record(JSON.parse(line.slice(6)));
        const choices = Array.isArray(payload?.choices) ? payload.choices : [];
        const choice = record(choices[0]);
        const delta = record(choice?.delta);
        const nextText = typeof delta?.content === "string" ? delta.content : "";
        const toolCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];
        if ((nextText || toolCalls.length > 0) && firstPartAt === undefined) {
          firstPartAt = performance.now();
        }
        content += nextText;
        for (const toolCall of toolCalls) {
          const name = record(record(toolCall)?.function)?.name;
          if (typeof name === "string") {
            toolNames.add(name);
          }
        }
        if (typeof choice?.finish_reason === "string") {
          finishReason = choice.finish_reason;
        }
        const usage = record(payload?.usage);
        if (typeof usage?.completion_tokens === "number") {
          outputTokens = usage.completion_tokens;
        }
      }
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  const endedAt = performance.now();
  const totalDurationMs = Math.round(endedAt - startedAt);
  const generationDurationMs = firstPartAt === undefined ? undefined : endedAt - firstPartAt;
  const headingsPresent = sample.expectedHeadings?.every((heading) => content.includes(heading));
  const expectedToolObserved = sample.expectedTool ? toolNames.has(sample.expectedTool) : undefined;

  return {
    answerQualityPassed:
      error === undefined &&
      (headingsPresent ?? true) &&
      (expectedToolObserved ?? true) &&
      (content.trim().length > 0 || toolNames.size > 0),
    case: sample.name,
    error,
    expectedToolObserved,
    feature: sample.feature,
    finishReason,
    headingsPresent,
    model,
    outputChars: content.length,
    outputCharsPerSecond:
      generationDurationMs && generationDurationMs > 0
        ? Math.round((content.length / generationDurationMs) * 1000)
        : undefined,
    outputTokens,
    status,
    timeToFirstPartMs: firstPartAt === undefined ? undefined : Math.round(firstPartAt - startedAt),
    toolNames: [...toolNames],
    totalDurationMs,
  };
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required to run the AI benchmark");
}

const results: Awaited<ReturnType<typeof probeModel>>[] = [];
const featureArgument = process.argv.find((argument) => argument.startsWith("--feature="));
const selectedFeature = featureArgument?.slice("--feature=".length);
const selectedPrompts = selectedFeature
  ? AI_BENCHMARK_PROMPTS.filter((sample) => sample.feature === selectedFeature)
  : AI_BENCHMARK_PROMPTS;
if (process.argv.includes("--all-models")) {
  const models = [
    ...new Set(Object.values(AI_RUNTIME_POLICIES).flatMap((policy) => [...policy.models])),
  ];
  for (const model of models) {
    for (const sample of selectedPrompts) {
      // biome-ignore lint/performance/noAwaitInLoops: Live provider probes are intentionally serialized to avoid rate-limit distortion.
      results.push(await probeModel(apiKey, model, sample, 18_000));
    }
  }
} else {
  for (const sample of selectedPrompts) {
    const policy = AI_RUNTIME_POLICIES[sample.feature];
    for (const model of policy.models) {
      // biome-ignore lint/performance/noAwaitInLoops: Fallback order must be measured sequentially exactly as production executes it.
      const result = await probeModel(apiKey, model, sample, policy.providerAttemptTimeoutMs);
      results.push(result);
      process.stderr.write(
        `${sample.name}: ${model} ${result.answerQualityPassed ? "passed" : "failed"}\n`
      );
      if (result.answerQualityPassed) {
        break;
      }
    }
  }
}

const fallbackSelections = selectedPrompts.map((sample) => {
  const policy = AI_RUNTIME_POLICIES[sample.feature];
  const attempts = policy.models.map((model) =>
    results.find((result) => result.model === model && result.case === sample.name)
  );
  const selectedIndex = attempts.findIndex((attempt) => attempt?.answerQualityPassed);
  return {
    attempts: attempts
      .slice(0, selectedIndex < 0 ? attempts.length : selectedIndex + 1)
      .map((attempt) => ({
        error: attempt?.error,
        model: attempt?.model,
        passed: attempt?.answerQualityPassed ?? false,
        status: attempt?.status,
      })),
    case: sample.name,
    fallback: selectedIndex > 0,
    selectedModel: selectedIndex < 0 ? undefined : attempts[selectedIndex]?.model,
  };
});

const report = {
  costAndPrivacyDecision: AI_MODEL_SELECTION_EVIDENCE.privacyDecision,
  fallbackSelections,
  measuredAt: new Date().toISOString(),
  results,
};
const output = process.argv.includes("--compact")
  ? {
      ...report,
      results: report.results.map((result) => ({
        ...result,
        error: result.error?.slice(0, 160),
      })),
    }
  : report;
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
