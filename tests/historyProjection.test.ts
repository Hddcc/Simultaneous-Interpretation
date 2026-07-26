import assert from "node:assert/strict";
import { toHistoryRecords } from "../src/history/projection";
import type { SubtitleSegment } from "../src/translation/types";

function segment(translatedText: string): SubtitleSegment {
  return {
    id: "segment-1",
    sourceText: "For many people.",
    translatedText,
    sourceLanguage: "英语",
    targetLanguage: "中文",
    status: "final",
    revision: 1,
    revisionReason: "initial",
    revisionProvenance: "initial",
    startedAtMs: 1000,
    endedAtMs: 1800,
    updatedAtMs: 2000,
    asrLatencyMs: 100,
    translationLatencyMs: 200,
    totalLatencyMs: 300,
    contextSize: 0,
    translationProvider: "mock",
    translationModel: "mock",
    translationError: null,
    translationFallback: false,
    audioEvidenceEndAtMs: null,
    asrReceivedAtMs: null,
    translationEligibleAtMs: null,
    translationRequestedAtMs: null,
    firstDraftReceivedAtMs: null,
    firstDraftVisibleAtMs: null,
    finalVisibleAtMs: null,
    refinementVisibleAtMs: null,
    fastDraftLatencyMs: null,
    endToEndLatencyMs: null,
    finalLatencyMs: null,
    historyBackfill: false,
    backfillAtMs: null,
    rollbackGuardStartedAtMs: 1000,
    revised: false
  };
}

const context = {
  sessionId: "session-a",
  captureEpoch: 2,
  sourceType: "system" as const,
  languagePairId: "en-to-zh"
};

const records = toHistoryRecords([segment("对许多人来说。")], context);
assert.equal(records.length, 1);
assert.equal(records[0].id, "session-a:2:segment-1");
assert.equal(records[0].translatedText, "对许多人来说。");
assert.equal(records[0].translationAvailable, true);
const unavailable = toHistoryRecords([segment("   ")], context);
assert.equal(unavailable.length, 1);
assert.equal(unavailable[0].translatedText, "   ");
assert.equal(unavailable[0].translationAvailable, false);

console.log("history projection checks passed");
