import assert from "node:assert/strict";
import { updateCaptionCueSnapshot, emptyCaptionCueSnapshot } from "../src/captions/cue";
import type { AsrSegment } from "../src/asr/types";
import type { SubtitleRefinementEvent, TranslationEvent } from "../src/translation/types";

function segment(id: string, text: string, revision: number, updatedAtMs: number): AsrSegment {
  return {
    id,
    sourceType: "system",
    text,
    status: revision >= 2 ? "final" : "partial",
    startedAtMs: updatedAtMs - 500,
    endedAtMs: updatedAtMs,
    updatedAtMs,
    latencyMs: 180,
    revision
  };
}

function translation(segmentId: string, text: string, revision: number, createdAtMs: number): TranslationEvent {
  return {
    id: `translation-${segmentId}-${revision}`,
    segmentId,
    sourceText: "hello world",
    translatedText: text,
    languagePairId: "en-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    status: revision >= 2 ? "translated" : "partial",
    revision,
    revisionReason: revision >= 2 ? "translation-correction" : "initial",
    createdAtMs,
    latencyMs: 320,
    contextSize: 0,
    provider: "aliyun",
    model: "qwen-plus",
    error: null,
    fallback: false
  };
}

const first = updateCaptionCueSnapshot({
  current: emptyCaptionCueSnapshot,
  asrSegments: [segment("cue-1", "hello", 1, 1000)],
  translationEvents: [],
  nowMs: 1100,
  cueHoldMs: 1000
});

assert.equal(first.active?.id, "cue-1");
assert.equal(first.active?.state, "listening");
assert.equal(first.previous, null);

const revised = updateCaptionCueSnapshot({
  current: first,
  asrSegments: [segment("cue-1", "hello world", 2, 1300)],
  translationEvents: [translation("cue-1", "你好，世界", 2, 1500)],
  nowMs: 1600,
  cueHoldMs: 1000
});

assert.equal(revised.active?.id, "cue-1");
assert.equal(revised.active?.translatedText, "你好，世界");
assert.equal(revised.active?.state, "final");
assert.equal(revised.active?.revised, true);

const second = updateCaptionCueSnapshot({
  current: revised,
  asrSegments: [segment("cue-2", "next sentence", 1, 2200)],
  translationEvents: [],
  nowMs: 2300,
  cueHoldMs: 1000
});

assert.equal(second.active?.id, "cue-2");
assert.equal(second.previous?.id, "cue-1");
assert.equal(second.history[0].id, "cue-1");

const expired = updateCaptionCueSnapshot({
  current: second,
  asrSegments: [],
  translationEvents: [],
  nowMs: 4000,
  cueHoldMs: 1000
});

assert.equal(expired.active, null);
assert.equal(expired.previous?.id, "cue-2");
assert.equal(expired.history[0].id, "cue-2");

const oldFinalSegment: AsrSegment = {
  ...segment("cue-1", "hello world finalized", 3, 3000),
  startedAtMs: 500,
  endedAtMs: 1300
};
const historyTranslation: TranslationEvent = {
  ...translation("cue-1", "你好，世界（补全）", 3, 3100),
  historyBackfill: true,
  lane: "backfill"
};
const historyRefinement: SubtitleRefinementEvent = {
  id: "refinement-cue-1-3",
  segmentId: "cue-1",
  sourceText: oldFinalSegment.text,
  translatedText: historyTranslation.translatedText,
  refinedSourceText: oldFinalSegment.text,
  refinedTranslatedText: "你好，世界。",
  languagePairId: "en-zh",
  sourceLanguage: "英语",
  targetLanguage: "中文",
  revision: 3,
  createdAtMs: 3200,
  latencyMs: 100,
  contextSize: 0,
  provider: "aliyun",
  model: "qwen-plus",
  error: null,
  fallback: false,
  reason: "history refinement",
  refinementVisibleAtMs: 3210
};
const noRollback = updateCaptionCueSnapshot({
  current: second,
  asrSegments: [oldFinalSegment],
  translationEvents: [historyTranslation],
  refinementEvents: [historyRefinement],
  nowMs: 3300,
  cueHoldMs: 1000
});
assert.equal(noRollback.active?.id, "cue-2");
assert.equal(noRollback.history.find((cue) => cue.id === "cue-1")?.translatedText, "你好，世界。");
assert.equal(noRollback.history.find((cue) => cue.id === "cue-1")?.revisionProvenance, "history-backfill");

const timedSegment: AsrSegment = {
  ...segment("timed", "timed source", 1, 1100),
  startedAtMs: 900,
  audioEvidenceEndAtMs: 1000,
  asrReceivedAtMs: 1100,
  timingCorrelation: "provider-offset"
};
const timedFirst: TranslationEvent = {
  ...translation("timed", "首稿", 1, 1400),
  audioEvidenceEndAtMs: 1000,
  asrReceivedAtMs: 1100,
  translationEligibleAtMs: 1150,
  translationRequestedAtMs: 1170,
  firstDraftReceivedAtMs: 1380,
  firstDraftVisibleAtMs: 1400
};
const timedCue = updateCaptionCueSnapshot({
  current: emptyCaptionCueSnapshot,
  asrSegments: [timedSegment],
  translationEvents: [timedFirst],
  nowMs: 1400
});
const revisedTiming = updateCaptionCueSnapshot({
  current: timedCue,
  asrSegments: [{ ...timedSegment, revision: 2, text: "timed source final", status: "final" }],
  translationEvents: [
    {
      ...timedFirst,
      revision: 2,
      translatedText: "最终译文",
      createdAtMs: 2400,
      firstDraftVisibleAtMs: 2400,
      finalVisibleAtMs: 2400
    },
    { ...timedFirst, revision: 1, translatedText: "迟到旧流", createdAtMs: 2500 }
  ],
  nowMs: 2500
});
assert.equal(revisedTiming.active?.translatedText, "最终译文");
assert.equal(revisedTiming.active?.latency.firstDraftVisibleAtMs, 1400);
assert.equal(revisedTiming.active?.latency.fastDraftLatencyMs, 250);
assert.equal(revisedTiming.active?.latency.endToEndLatencyMs, 400);

console.log("caption cue checks passed");
