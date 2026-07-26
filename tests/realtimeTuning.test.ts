import assert from "node:assert/strict";
import type { AsrSegment } from "../src/asr/types";
import { DEFAULT_REALTIME_LATENCY_TUNING } from "../src/realtime/tuning";
import { createLowLatencyTranslationScheduler } from "../src/translation/scheduler";
import type { TranslationLanguagePair, TranslationRequest } from "../src/translation/types";

assert.deepEqual(DEFAULT_REALTIME_LATENCY_TUNING, {
  audioChunkDurationMs: 160,
  providerAsrPollIntervalMs: 750,
  minPartialCharacters: 10,
  minPartialWords: 3,
  partialDebounceMs: 120,
  latencyWarningMs: 1500
});

const languagePair: TranslationLanguagePair = {
  id: "en-zh",
  source: { code: "en", label: "英语", translationLocale: "English" },
  target: { code: "zh", label: "中文", translationLocale: "Chinese" },
  translationModel: "qwen-turbo"
};

function segment(index: number): AsrSegment {
  return {
    id: `burst-${index}`,
    sourceType: "system",
    text: `rapid partial sentence ${index}`,
    status: "partial",
    startedAtMs: index * 160,
    endedAtMs: index * 160 + 160,
    updatedAtMs: 10_000 + index,
    latencyMs: 100,
    revision: 1,
    audioEvidenceEndAtMs: 9_900 + index,
    asrReceivedAtMs: 10_000 + index,
    timingCorrelation: "provider-offset"
  };
}

function event(request: TranslationRequest) {
  return {
    id: `translation-${request.segment.id}`,
    segmentId: request.segment.id,
    sourceText: request.segment.text,
    translatedText: `译文 ${request.segment.id}`,
    languagePairId: request.languagePair.id,
    sourceLanguage: "英语",
    targetLanguage: "中文",
    status: "partial" as const,
    revision: 1,
    revisionReason: "initial" as const,
    createdAtMs: Date.now(),
    latencyMs: 200,
    contextSize: 0,
    provider: "aliyun" as const,
    model: "qwen-turbo",
    error: null,
    fallback: false
  };
}

async function main(): Promise<void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const scheduler = createLowLatencyTranslationScheduler(
    {
      async translate(request) {
        calls += 1;
        if (calls === 1) {
          await gate;
        }
        return event(request);
      }
    },
    {
      minPartialCharacters: DEFAULT_REALTIME_LATENCY_TUNING.minPartialCharacters,
      minPartialWords: DEFAULT_REALTIME_LATENCY_TUNING.minPartialWords,
      partialDebounceMs: DEFAULT_REALTIME_LATENCY_TUNING.partialDebounceMs
    }
  );

  const pending = Array.from({ length: 50 }, (_, index) =>
    scheduler.schedule({
      segment: segment(index),
      languagePair,
      context: [],
      nowMs: 10_100 + index
    })
  );
  assert.equal(scheduler.getDiagnostics().activeLaneDepth, 2);
  assert.equal(scheduler.getDiagnostics().cancellationAttempts, 1);
  release();
  const results = await Promise.all(pending);
  assert.equal(calls, 2);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.at(-1)?.segmentId, "burst-49");
  assert.equal(scheduler.getDiagnostics().supersededPartials, 49);

  console.log("realtime tuning checks passed");
}

void main();
