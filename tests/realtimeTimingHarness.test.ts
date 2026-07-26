import assert from "node:assert/strict";
import { createDeferredHistoryWriter } from "../src/history/deferredWriter";
import type { HistoryRecord } from "../src/history/types";
import type { ProviderLatencySample } from "../src/realtime/latency";
import { ProviderLatencyReferenceRunner } from "../src/verification/realtimeLatencyReport";

function sample(index: number, fastDraftMs: number, options?: { fallback?: boolean; error?: string | null; missingAudio?: boolean }): ProviderLatencySample {
  const audioEvidenceEndAtMs = 10_000 + index * 1000;
  const translationEligibleAtMs = audioEvidenceEndAtMs + 180;
  const firstDraftVisibleAtMs = translationEligibleAtMs + fastDraftMs;
  return {
    id: `sample-${index}`,
    providerBacked: true,
    fallback: options?.fallback ?? false,
    error: options?.error ?? null,
    audioEvidenceEndAtMs: options?.missingAudio ? null : audioEvidenceEndAtMs,
    asrReceivedAtMs: audioEvidenceEndAtMs + 140,
    translationEligibleAtMs,
    translationRequestedAtMs: translationEligibleAtMs + 10,
    firstDraftReceivedAtMs: firstDraftVisibleAtMs - 20,
    firstDraftVisibleAtMs,
    finalVisibleAtMs: firstDraftVisibleAtMs + 300,
    refinementVisibleAtMs: firstDraftVisibleAtMs + 800
  };
}

const passing = new ProviderLatencyReferenceRunner(5);
for (let index = 0; index < 55; index += 1) {
  passing.recordSample(sample(index, 300 + (index % 5) * 20));
}
passing.recordCatchUp({ atMs: 1000, activeLag: 1, pressureActive: true, catchUpState: "catching-up" });
passing.recordCatchUp({ atMs: 1400, activeLag: 1, pressureActive: false, catchUpState: "catching-up" });
passing.recordCatchUp({ atMs: 2200, activeLag: 0, pressureActive: false, catchUpState: "healthy" });
const passingReport = passing.report({
  requestCount: 52,
  supersededPartials: 3,
  cancellationAttempts: 2,
  cancellationSucceeded: 1,
  cancellationIgnored: 1
}, 3000);

assert.equal(passingReport.warmupSamples, 5);
assert.equal(passingReport.latency.fastDraft.count, 50);
assert.equal(passingReport.latency.fastDraft.mean, 340);
assert.equal(passingReport.latency.fastDraft.p95, 380);
assert.equal(passingReport.latency.endToEnd.p95, 560);
assert.equal(passingReport.maximumActiveLag, 1);
assert.equal(passingReport.recoveryMs, 800);
assert.equal(passingReport.passed, true);

const failing = new ProviderLatencyReferenceRunner(5);
for (let index = 0; index < 55; index += 1) {
  failing.recordSample(sample(index, index % 10 === 0 ? 1200 : 700));
}
failing.recordCatchUp({ atMs: 0, activeLag: 3, pressureActive: true, catchUpState: "catching-up" });
failing.recordCatchUp({ atMs: 1000, activeLag: 2, pressureActive: false, catchUpState: "catching-up" });
failing.recordCatchUp({ atMs: 3500, activeLag: 0, pressureActive: false, catchUpState: "healthy" });
const failingReport = failing.report();
assert.equal(failingReport.checks.fastDraftMean, false);
assert.equal(failingReport.checks.fastDraftP95, false);
assert.equal(failingReport.checks.activeLag, false);
assert.equal(failingReport.checks.recovery, false);
assert.equal(failingReport.passed, false);

const excluded = new ProviderLatencyReferenceRunner(0);
excluded.recordSample(sample(1, 200, { fallback: true }));
excluded.recordSample(sample(2, 200, { error: "rate limited" }));
excluded.recordSample(sample(3, 200, { missingAudio: true }));
const excludedReport = excluded.report();
assert.equal(excludedReport.latency.fastDraft.count, 1);
assert.equal(excludedReport.latency.endToEnd.count, 0);
assert.equal(excludedReport.latency.errors, 1);
assert.equal(excludedReport.latency.fallbacks, 1);
assert.equal(excludedReport.latency.missingTimestamps.endToEnd, 1);

function firstDraftVisibleWithHistory(historySize: number): number {
  const currentHistory = Array.from({ length: historySize }, (_, index): HistoryRecord => ({
    id: `session:segment-${index}`,
    sessionId: "session",
    segmentId: `segment-${index}`,
    sourceType: "system",
    languagePairId: "en-to-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    sourceText: `Source ${index}`,
    translatedText: `译文${index}`,
    startedAtMs: index * 1000,
    endedAtMs: index * 1000 + 500,
    updatedAtMs: index * 1000 + 600,
    revised: false
  }));
  let synchronousCommits = 0;
  const writer = createDeferredHistoryWriter({
    commit: () => { synchronousCommits += 1; },
    requestFrame: () => 1,
    cancelFrame: () => undefined,
    setTimer: () => 2,
    clearTimer: () => undefined
  });

  const firstDraftVisibleAtMs = 10_000;
  writer.enqueue(currentHistory.slice(-1));
  assert.equal(synchronousCommits, 0);
  return firstDraftVisibleAtMs;
}

assert.equal(firstDraftVisibleWithHistory(0), firstDraftVisibleWithHistory(500));

console.log("realtime timing harness checks passed");
