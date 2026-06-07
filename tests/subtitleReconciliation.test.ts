import assert from "node:assert/strict";
import type { AsrSegment } from "../src/asr/types";
import {
  DEFAULT_REVISION_WINDOW,
  reconcileSubtitleSegments
} from "../src/subtitles/reconciliation";
import type { SubtitleSegment, TranslationEvent } from "../src/translation/types";

function createAsrSegment(
  id: string,
  text: string,
  status: "partial" | "final",
  startedAtMs: number
): AsrSegment {
  return {
    id,
    sourceType: "system",
    text,
    status,
    startedAtMs,
    endedAtMs: startedAtMs + 900,
    updatedAtMs: startedAtMs + 920,
    latencyMs: status === "final" ? 260 : 140,
    revision: 1
  };
}

function createTranslationEvent(
  segmentId: string,
  sourceText: string,
  translatedText: string,
  fallback = false
): TranslationEvent {
  return {
    id: `translation-${segmentId}`,
    segmentId,
    sourceText,
    translatedText,
    languagePairId: "en-to-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    status: "translated",
    revision: 1,
    revisionReason: "translation-correction",
    createdAtMs: 2000,
    latencyMs: 310,
    contextSize: 2,
    provider: "openai",
    model: "gpt-4.1-mini",
    error: fallback ? "provider unavailable" : null,
    fallback
  };
}

function applyOne(
  current: SubtitleSegment[],
  event: TranslationEvent,
  asrSegment: AsrSegment,
  providerConnectionState: string | null = null
): SubtitleSegment[] {
  return reconcileSubtitleSegments({
    current,
    translationEvents: [event],
    asrSegments: [asrSegment],
    revisionWindow: DEFAULT_REVISION_WINDOW,
    providerConnectionState
  }).segments;
}

const partial = applyOne(
  [],
  createTranslationEvent("seg-1", "The pipeline receives", "这条链路会接收"),
  createAsrSegment("seg-1", "The pipeline receives", "partial", 1000)
);

assert.equal(partial[0].revision, 1);
assert.equal(partial[0].status, "partial");
assert.equal(partial[0].revisionProvenance, "initial");

const finalized = applyOne(
  partial,
  createTranslationEvent(
    "seg-1",
    "The pipeline receives small audio chunks",
    "这条链路会接收小段音频"
  ),
  createAsrSegment("seg-1", "The pipeline receives small audio chunks", "final", 1000)
);

assert.equal(finalized[0].revision, 2);
assert.equal(finalized[0].status, "final");
assert.equal(finalized[0].revisionProvenance, "asr-finalization");

const translated = applyOne(
  finalized,
  createTranslationEvent(
    "seg-1",
    "The pipeline receives small audio chunks",
    "这条链路会接收小段音频块"
  ),
  createAsrSegment("seg-1", "The pipeline receives small audio chunks", "final", 1000)
);

assert.equal(translated[0].revision, 3);
assert.equal(translated[0].revisionProvenance, "translation-correction");

const fallback = applyOne(
  translated,
  createTranslationEvent(
    "seg-1",
    "The pipeline receives small audio chunks",
    "The pipeline receives small audio chunks",
    true
  ),
  createAsrSegment("seg-1", "The pipeline receives small audio chunks", "final", 1000)
);

assert.equal(fallback[0].revision, 4);
assert.equal(fallback[0].revisionProvenance, "manual-fallback");
assert.equal(fallback[0].translationFallback, true);

const oldSegments: SubtitleSegment[] = Array.from({ length: 5 }, (_, index) => ({
  ...translated[0],
  id: `seg-${index + 1}`,
  sourceText: `source-${index + 1}`,
  translatedText: `translated-${index + 1}`,
  startedAtMs: 5000 - index * 1000,
  revision: 1
}));

const oldRevisionAttempt = applyOne(
  oldSegments,
  createTranslationEvent("seg-5", "source-5 updated", "translated-5 updated"),
  createAsrSegment("seg-5", "source-5 updated", "final", 1000)
);

assert.equal(oldRevisionAttempt.find((segment) => segment.id === "seg-5")?.sourceText, "source-5");
assert.equal(oldRevisionAttempt.find((segment) => segment.id === "seg-5")?.revision, 1);

const reconnectRevision = applyOne(
  translated,
  createTranslationEvent(
    "seg-1",
    "The pipeline receives small audio chunks after reconnect",
    "重连后，这条链路会接收小段音频块"
  ),
  createAsrSegment(
    "seg-1",
    "The pipeline receives small audio chunks after reconnect",
    "final",
    1000
  ),
  "reconnecting"
);

assert.equal(reconnectRevision[0].revisionProvenance, "provider-reconnect");

console.log("subtitle reconciliation checks passed");
