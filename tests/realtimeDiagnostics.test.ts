import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRealtimeDiagnosticsSnapshot } from "../src/realtime/diagnostics";
import { SessionLatencyAggregator } from "../src/realtime/latency";
import { createSubtitleRefinementScheduler } from "../src/translation/refinementScheduler";
import { createLowLatencyTranslationScheduler } from "../src/translation/scheduler";

const latency = new SessionLatencyAggregator();
latency.record({
  id: "sample-1",
  providerBacked: true,
  fallback: false,
  error: null,
  audioEvidenceEndAtMs: 1000,
  translationEligibleAtMs: 1100,
  firstDraftVisibleAtMs: 1400,
  finalVisibleAtMs: 1600,
  refinementVisibleAtMs: 1900
});

const translation = createLowLatencyTranslationScheduler({
  translate: async () => {
    throw new Error("unused");
  }
});
const refinement = createSubtitleRefinementScheduler({
  refine: async () => {
    throw new Error("unused");
  }
});
refinement.updatePressure({
  activeLag: 2,
  translationBacklog: 0,
  asrQueueRatio: 0,
  fastDraftLatencyMs: 300
});

const snapshot = createRealtimeDiagnosticsSnapshot({
  latency: latency.snapshot(),
  translation: translation.getDiagnostics(),
  refinement: refinement.getDiagnostics(),
  providerQueue: { depth: 3, maxDepth: 12 },
  providerTiming: { correlatedEvents: 8, uncorrelatedEvents: 2 },
  nowMs: 2000
});

assert.equal(snapshot.capturedAtMs, 2000);
assert.equal(snapshot.latency.fastDraft.mean, 300);
assert.equal(snapshot.latency.endToEnd.p95, 400);
assert.equal(snapshot.translation.activeLaneDepth, 0);
assert.equal(snapshot.translation.requestCount, 0);
assert.equal(snapshot.refinement.paused, true);
assert.equal(snapshot.refinement.pauseReason, "active-lag");
assert.equal(snapshot.provider.queueRatio, 0.25);
assert.equal(snapshot.provider.uncorrelatedAsrEvents, 2);

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
for (const existingLabel of ["开始同传", "停止同传", "字幕历史", "悬浮字幕"]) {
  assert.ok(appSource.includes(existingLabel));
}
for (const internalLabel of ["追帧状态", "历史补全状态", "P95 延迟", "Fast Draft"]) {
  assert.equal(appSource.includes(internalLabel), false);
}
assert.equal(styles.includes("catch-up-panel"), false);
assert.equal(styles.includes("backfill-badge"), false);

console.log("realtime diagnostics checks passed");
