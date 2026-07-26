import assert from "node:assert/strict";
import { createSubtitleRefinementScheduler } from "../src/translation/refinementScheduler";
import type {
  SubtitleRefinementClient,
  SubtitleRefinementRequest,
  TranslationLanguagePair
} from "../src/translation/types";

const languagePair: TranslationLanguagePair = {
  id: "en-zh",
  source: {
    code: "en-US",
    label: "英语",
    translationLocale: "English"
  },
  target: {
    code: "zh-CN",
    label: "中文",
    translationLocale: "Chinese"
  },
  translationModel: "qwen-plus"
};

function request(segmentId: string, revision: number, translatedText = "直译文本"): SubtitleRefinementRequest {
  return {
    segmentId,
    sourceText: "And I've put below my main topics for today.",
    translatedText,
    languagePair,
    context: [],
    revision,
    status: "final"
  };
}

let calls = 0;
const client: SubtitleRefinementClient = {
  async refine(input) {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      id: `refinement-${input.segmentId}-${input.revision}`,
      segmentId: input.segmentId,
      sourceText: input.sourceText,
      translatedText: input.translatedText,
      refinedSourceText: "I've listed today's main topics below.",
      refinedTranslatedText: `自然译文 ${input.revision}`,
      languagePairId: input.languagePair.id,
      sourceLanguage: input.languagePair.source.label,
      targetLanguage: input.languagePair.target.label,
      revision: input.revision,
      createdAtMs: Date.now(),
      latencyMs: 90,
      contextSize: input.context.length,
      provider: "aliyun",
      model: "qwen-plus",
      error: null,
      fallback: false,
      reason: "natural subtitle"
    };
  }
};

async function main(): Promise<void> {
  const scheduler = createSubtitleRefinementScheduler(client);
  assert.equal(scheduler.shouldRefine({ ...request("s1", 1), status: "partial" }), false);
  assert.equal(scheduler.shouldRefine(request("s1", 1)), true);

  const first = await scheduler.schedule(request("s1", 1));
  const reused = await scheduler.schedule(request("s1", 1));
  assert.equal(first?.refinedTranslatedText, "自然译文 1");
  assert.equal(reused?.refinedTranslatedText, "自然译文 1");
  assert.equal(calls, 1);
  assert.equal(scheduler.getDiagnostics().reused, 1);

  const staleScheduler = createSubtitleRefinementScheduler(client);
  const stalePromise = staleScheduler.schedule(request("s2", 1));
  const latestPromise = staleScheduler.schedule(request("s2", 2));
  const stale = await stalePromise;
  const latest = await latestPromise;
  assert.equal(stale, null);
  assert.equal(latest?.revision, 2);
  assert.equal(staleScheduler.getDiagnostics().droppedStale, 1);

  scheduler.updatePressure({
    activeLag: 2,
    translationBacklog: 0,
    asrQueueRatio: 0,
    fastDraftLatencyMs: 200
  });
  assert.equal(scheduler.getDiagnostics().paused, true);
  assert.equal(scheduler.getDiagnostics().pauseReason, "active-lag");
  assert.equal(await scheduler.schedule(request("paused", 1)), null);
  assert.equal(scheduler.getDiagnostics().skippedWhilePaused, 1);

  scheduler.updatePressure({
    activeLag: 0,
    translationBacklog: 0,
    asrQueueRatio: 0,
    fastDraftLatencyMs: 200
  });
  assert.equal(scheduler.getDiagnostics().paused, false);
  assert.equal(scheduler.getDiagnostics().resumed, 1);
  await scheduler.schedule(request("resumed", 1));
  assert.equal(scheduler.getDiagnostics().latencyDistribution.count, 2);
  assert.equal(scheduler.getDiagnostics().latencyDistribution.mean, 90);
  assert.equal(scheduler.getDiagnostics().latencyDistribution.p95, 90);

  const pressureCases = [
    {
      input: { activeLag: 0, translationBacklog: 3, asrQueueRatio: 0, fastDraftLatencyMs: 200 },
      reason: "translation-backlog"
    },
    {
      input: { activeLag: 0, translationBacklog: 0, asrQueueRatio: 0.75, fastDraftLatencyMs: 200 },
      reason: "asr-queue-pressure"
    },
    {
      input: { activeLag: 0, translationBacklog: 0, asrQueueRatio: 0, fastDraftLatencyMs: 901 },
      reason: "fast-draft-latency"
    }
  ] as const;
  pressureCases.forEach(({ input, reason }) => {
    scheduler.updatePressure(input);
    assert.equal(scheduler.getDiagnostics().pauseReason, reason);
  });

  console.log("refinement scheduler checks passed");
}

void main();
