import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { buildTranslationMessages, isReadableTranslationDraft } from "../electron/translationPrompt";
import {
  evaluateTranslationQuality,
  selectFastDraftDefault,
  summarizeLatencies,
  type BenchmarkQualityRule,
  type FastDraftCandidateSummary
} from "../src/verification/fastDraftModelBenchmark";

interface FixedSampleManifest {
  id: string;
  description: string;
  sourceLanguage: string;
  targetLanguage: string;
  minimumQualityPassRate: number;
  preserveLiterals: string[];
  qualityRules: BenchmarkQualityRule[];
  utterances: Array<{
    id: string;
    text: string;
    partials: string[];
  }>;
}

interface MeasuredRequest {
  sampleId: string;
  sourceText: string;
  translatedText: string;
  firstDraftText: string;
  firstReadableMs: number;
  completeMs: number;
  streaming: boolean;
  qualityPassed: boolean;
  qualityFailures: string[];
  error: string | null;
}

interface ProviderResponse {
  translatedText: string;
  firstDraftText: string;
  firstReadableMs: number;
  completeMs: number;
  streaming: boolean;
}

interface CliOptions {
  samplePath: string;
  audioPath: string;
  outputPath: string;
  models: string[];
  warmupSamples: number;
  measuredSamples: number;
  reuseResultsPath: string | null;
}

const DEFAULT_SAMPLE_PATH = "scripts/fixtures/realtime-catch-up-english.json";
const DEFAULT_AUDIO_PATH = "docs/verification/fixtures/realtime-catch-up-english.wav";
const DEFAULT_OUTPUT_PATH = "docs/verification/fast-draft-model-benchmark.json";
const DEFAULT_MODELS = ["qwen-turbo", "qwen-plus"];
const TARGETS = {
  minimumSamples: 50,
  meanMs: 500,
  p95Ms: 900
} as const;

function parseArgs(argv: string[]): CliOptions {
  const readOption = (name: string, fallback: string): string => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const models = readOption("--models", DEFAULT_MODELS.join(","))
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return {
    samplePath: readOption("--sample", DEFAULT_SAMPLE_PATH),
    audioPath: readOption("--audio", DEFAULT_AUDIO_PATH),
    outputPath: readOption("--output", DEFAULT_OUTPUT_PATH),
    models,
    warmupSamples: Number(readOption("--warmup", "5")),
    measuredSamples: Number(readOption("--samples", "50")),
    reuseResultsPath: argv.includes("--reuse-results")
      ? readOption("--reuse-results", "") || null
      : null
  };
}

async function loadLocalEnv(path: string): Promise<void> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch {
    return;
  }
  contents.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) {
      return;
    }
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  });
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function readChatText(payload: unknown): string {
  const value = payload as { choices?: Array<{ message?: { content?: string } }> };
  return value.choices?.[0]?.message?.content?.trim() ?? "";
}

async function requestTranslation(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  manifest: FixedSampleManifest;
  sourceText: string;
}): Promise<ProviderResponse> {
  const startedAt = performance.now();
  const response = await fetch(endpoint(input.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      messages: buildTranslationMessages({
        text: input.sourceText,
        sourceLanguage: input.manifest.sourceLanguage,
        targetLanguage: input.manifest.targetLanguage,
        fastDraft: true
      }),
      temperature: 0.1,
      stream: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    const translatedText = readChatText(await response.json());
    if (!translatedText) {
      throw new Error("Provider returned an empty complete response.");
    }
    const completeMs = Math.round(performance.now() - startedAt);
    return {
      translatedText,
      firstDraftText: translatedText,
      firstReadableMs: completeMs,
      completeMs,
      streaming: false
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let translatedText = "";
  let firstDraftText = "";
  let firstReadableMs: number | null = null;

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(trimmed.slice(5).trim()) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      translatedText += payload.choices?.[0]?.delta?.content ?? "";
      if (firstReadableMs === null && isReadableTranslationDraft(translatedText, 6)) {
        firstReadableMs = Math.round(performance.now() - startedAt);
        firstDraftText = translatedText;
      }
    } catch {
      // Provider keepalive and non-content chunks do not affect the measured draft.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) {
      break;
    }
  }
  if (buffer) {
    consumeLine(buffer);
  }
  const completeMs = Math.round(performance.now() - startedAt);
  const completeText = translatedText.trim();
  if (!completeText) {
    throw new Error("Provider returned an empty translation stream.");
  }
  return {
    translatedText: completeText,
    firstDraftText: firstDraftText || completeText,
    firstReadableMs: firstReadableMs ?? completeMs,
    completeMs,
    streaming: true
  };
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.models.length < 2) {
    throw new Error("Benchmark at least two candidate models with --models.");
  }
  if (options.measuredSamples < TARGETS.minimumSamples) {
    throw new Error(`--samples must be at least ${TARGETS.minimumSamples}.`);
  }

  await loadLocalEnv(resolve(".env"));
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!options.reuseResultsPath && !apiKey) {
    throw new Error("DASHSCOPE_API_KEY is required in the process environment or .env.");
  }
  const baseUrl = process.env.TRANSLATION_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const samplePath = resolve(options.samplePath);
  const audioPath = resolve(options.audioPath);
  const manifest = JSON.parse(await readFile(samplePath, "utf8")) as FixedSampleManifest;
  const samples = manifest.utterances.flatMap((utterance) =>
    utterance.partials.map((sourceText, index) => ({
      id: `${utterance.id}-partial-${index + 1}`,
      sourceText
    }))
  );
  if (samples.length < options.measuredSamples) {
    throw new Error(
      `Fixed sample exposes ${samples.length} partials; ${options.measuredSamples} are required.`
    );
  }

  let reusedProviderRun: {
    generatedAt?: string;
    environment?: Record<string, unknown>;
    method?: { providerRunGeneratedAt?: string | null };
  } | null = null;
  let warmupErrors: Record<string, string[]> = Object.fromEntries(
    options.models.map((model) => [model, []])
  );
  let measuredByModel: Record<string, MeasuredRequest[]>;

  if (options.reuseResultsPath) {
    const reused = JSON.parse(await readFile(resolve(options.reuseResultsPath), "utf8")) as {
      generatedAt?: string;
      environment?: Record<string, unknown>;
      method?: { providerRunGeneratedAt?: string | null };
      warmupErrors?: Record<string, string[]>;
      candidates?: Array<{ model: string; requests: MeasuredRequest[] }>;
    };
    reusedProviderRun = reused;
    warmupErrors = reused.warmupErrors ?? warmupErrors;
    measuredByModel = Object.fromEntries(
      options.models.map((model) => {
        const requests = reused.candidates?.find((candidate) => candidate.model === model)?.requests;
        if (!requests || requests.length < options.measuredSamples) {
          throw new Error(`Reusable report does not contain ${options.measuredSamples} ${model} requests.`);
        }
        return [
          model,
          requests.slice(0, options.measuredSamples).map((request) => {
            if (request.error) {
              return request;
            }
            const quality = evaluateTranslationQuality({
              sourceText: request.sourceText,
              translatedText: request.translatedText,
              preserveLiterals: manifest.preserveLiterals,
              qualityRules: manifest.qualityRules
            });
            return {
              ...request,
              qualityPassed: quality.passed,
              qualityFailures: quality.failures
            };
          })
        ];
      })
    );
  } else {
    for (let index = 0; index < options.warmupSamples; index += 1) {
      for (const model of options.models) {
        try {
          await requestTranslation({
            apiKey: apiKey!,
            baseUrl,
            model,
            manifest,
            sourceText: samples[index % samples.length].sourceText
          });
        } catch (error) {
          warmupErrors[model].push(error instanceof Error ? error.message : String(error));
        }
      }
    }

    measuredByModel = Object.fromEntries(options.models.map((model) => [model, []]));
    for (let index = 0; index < options.measuredSamples; index += 1) {
      const sample = samples[index];
      for (const model of options.models) {
        try {
          const response = await requestTranslation({
            apiKey: apiKey!,
            baseUrl,
            model,
            manifest,
            sourceText: sample.sourceText
          });
          const quality = evaluateTranslationQuality({
            sourceText: sample.sourceText,
            translatedText: response.translatedText,
            preserveLiterals: manifest.preserveLiterals,
            qualityRules: manifest.qualityRules
          });
          measuredByModel[model].push({
            sampleId: sample.id,
            sourceText: sample.sourceText,
            translatedText: response.translatedText,
            firstDraftText: response.firstDraftText,
            firstReadableMs: response.firstReadableMs,
            completeMs: response.completeMs,
            streaming: response.streaming,
            qualityPassed: quality.passed,
            qualityFailures: quality.failures,
            error: null
          });
        } catch (error) {
          measuredByModel[model].push({
            sampleId: sample.id,
            sourceText: sample.sourceText,
            translatedText: "",
            firstDraftText: "",
            firstReadableMs: 0,
            completeMs: 0,
            streaming: false,
            qualityPassed: false,
            qualityFailures: ["provider-error"],
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      process.stdout.write(`Measured ${index + 1}/${options.measuredSamples}\r`);
    }
    process.stdout.write("\n");
  }

  const summaries: FastDraftCandidateSummary[] = options.models.map((model) => {
    const requests = measuredByModel[model];
    const successful = requests.filter((request) => request.error === null);
    return {
      model,
      attempted: requests.length,
      successful: successful.length,
      errors: requests.length - successful.length,
      qualityPassRate:
        successful.length === 0
          ? 0
          : successful.filter((request) => request.qualityPassed).length / successful.length,
      latency: summarizeLatencies(successful.map((request) => request.firstReadableMs))
    };
  });
  const targets = { ...TARGETS, minimumQualityPassRate: manifest.minimumQualityPassRate };
  const selection = selectFastDraftDefault(summaries, targets);
  const audioBuffer = await readFile(audioPath);
  const audioDurationMs = Math.round(
    ((audioBuffer.length - 44) / (16000 * 2)) * 1000
  );
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: {
      os: reusedProviderRun?.environment?.os ?? `${platform()} ${release()}`,
      provider: reusedProviderRun?.environment?.provider ?? "aliyun",
      endpoint: reusedProviderRun?.environment?.endpoint ?? baseUrl,
      streaming: reusedProviderRun?.environment?.streaming ?? true,
      temperature: reusedProviderRun?.environment?.temperature ?? 0.1,
      candidateOrder: reusedProviderRun?.environment?.candidateOrder ?? options.models
    },
    fixedSample: {
      id: manifest.id,
      description: manifest.description,
      manifestPath: options.samplePath,
      manifestSha256: await sha256(samplePath),
      audioPath: options.audioPath,
      audioSha256: createHash("sha256").update(audioBuffer).digest("hex"),
      audioDurationMs,
      partialCount: samples.length
    },
    method: {
      warmupSamplesPerModel: options.warmupSamples,
      measuredSamplesPerModel: options.measuredSamples,
      alternatingCandidates: true,
      latencyStart: "request dispatch",
      latencyEnd: "first draft satisfying the production six-character readable boundary",
      qualityEvaluation: "complete streamed translation",
      reusedProviderResultsFrom: options.reuseResultsPath,
      providerRunGeneratedAt:
        reusedProviderRun?.method?.providerRunGeneratedAt ?? reusedProviderRun?.generatedAt ?? null
    },
    targets,
    warmupErrors,
    candidates: summaries.map((summary) => ({
      ...summary,
      streamingResponses: measuredByModel[summary.model].filter((request) => request.streaming).length,
      qualityPassed: measuredByModel[summary.model].filter((request) => request.qualityPassed).length,
      requests: measuredByModel[summary.model]
    })),
    evaluations: selection.evaluations,
    selectedDefault: selection.model,
    passed: selection.evaluations.some(
      (evaluation) => evaluation.model === selection.model && evaluation.eligible
    )
  };

  await mkdir(dirname(resolve(options.outputPath)), { recursive: true });
  await writeFile(resolve(options.outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    selectedDefault: report.selectedDefault,
    passed: report.passed,
    summaries,
    outputPath: options.outputPath
  }, null, 2)}\n`);
  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
