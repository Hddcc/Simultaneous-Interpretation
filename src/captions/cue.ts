import type { AsrSegment } from "../asr/types";
import { calculateRealtimeLatencies } from "../realtime/latency";
import type { SubtitleRefinementEvent, SubtitleSegment, TranslationEvent } from "../translation/types";

export type CaptionCueState = "listening" | "drafting" | "translated" | "revising" | "final";

export interface CaptionCueLatency {
  asrLatencyMs: number | null;
  translationLatencyMs: number | null;
  refinementLatencyMs: number | null;
  totalLatencyMs: number | null;
  visibleLatencyMs: number | null;
  audioEvidenceEndAtMs: number | null;
  asrReceivedAtMs: number | null;
  translationEligibleAtMs: number | null;
  translationRequestedAtMs: number | null;
  firstDraftReceivedAtMs: number | null;
  firstDraftVisibleAtMs: number | null;
  finalVisibleAtMs: number | null;
  refinementVisibleAtMs: number | null;
  fastDraftLatencyMs: number | null;
  endToEndLatencyMs: number | null;
  finalLatencyMs: number | null;
}

export interface CaptionCueProviderMetadata {
  provider: SubtitleSegment["translationProvider"] | "pending";
  model: string;
  fallback: boolean;
  error: string | null;
}

export interface CaptionCue {
  id: string;
  sourceText: string;
  translatedText: string;
  state: CaptionCueState;
  revision: number;
  sourceLanguage: string;
  targetLanguage: string;
  startedAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  revised: boolean;
  revisionProvenance: SubtitleSegment["revisionProvenance"];
  historyBackfill: boolean;
  rollbackGuardStartedAtMs: number;
  latency: CaptionCueLatency;
  provider: CaptionCueProviderMetadata;
}

export interface CaptionCueSnapshot {
  active: CaptionCue | null;
  previous: CaptionCue | null;
  history: CaptionCue[];
}

export interface CaptionCueUpdateInput {
  current: CaptionCueSnapshot;
  asrSegments: AsrSegment[];
  translationEvents: TranslationEvent[];
  refinementEvents?: SubtitleRefinementEvent[];
  nowMs: number;
  cueHoldMs?: number;
  historyLimit?: number;
  sourceLanguageLabel?: string;
  targetLanguageLabel?: string;
}

const DEFAULT_CUE_HOLD_MS = 3200;
const DEFAULT_HISTORY_LIMIT = 24;

export const emptyCaptionCueSnapshot: CaptionCueSnapshot = {
  active: null,
  previous: null,
  history: []
};

function createEmptyLatency(segment?: AsrSegment): CaptionCueLatency {
  return {
    asrLatencyMs: segment?.latencyMs ?? null,
    translationLatencyMs: null,
    refinementLatencyMs: null,
    totalLatencyMs: segment?.latencyMs ?? null,
    visibleLatencyMs: null,
    audioEvidenceEndAtMs: segment?.audioEvidenceEndAtMs ?? null,
    asrReceivedAtMs: segment?.asrReceivedAtMs ?? null,
    translationEligibleAtMs: null,
    translationRequestedAtMs: null,
    firstDraftReceivedAtMs: null,
    firstDraftVisibleAtMs: null,
    finalVisibleAtMs: null,
    refinementVisibleAtMs: null,
    fastDraftLatencyMs: null,
    endToEndLatencyMs: null,
    finalLatencyMs: null
  };
}

function applyTranslationLatency(
  current: CaptionCueLatency,
  translation: TranslationEvent,
  nowMs: number
): CaptionCueLatency {
  const timing = {
    audioEvidenceEndAtMs:
      current.audioEvidenceEndAtMs ?? translation.audioEvidenceEndAtMs ?? null,
    asrReceivedAtMs: current.asrReceivedAtMs ?? translation.asrReceivedAtMs ?? null,
    translationEligibleAtMs:
      current.translationEligibleAtMs ?? translation.translationEligibleAtMs ?? null,
    translationRequestedAtMs:
      current.translationRequestedAtMs ?? translation.translationRequestedAtMs ?? null,
    firstDraftReceivedAtMs:
      current.firstDraftReceivedAtMs ?? translation.firstDraftReceivedAtMs ?? null,
    firstDraftVisibleAtMs:
      current.firstDraftVisibleAtMs ?? translation.firstDraftVisibleAtMs ?? nowMs,
    finalVisibleAtMs: translation.finalVisibleAtMs ?? current.finalVisibleAtMs,
    refinementVisibleAtMs: current.refinementVisibleAtMs
  };
  const metrics = calculateRealtimeLatencies(timing);

  return {
    ...current,
    ...timing,
    translationLatencyMs: translation.latencyMs,
    totalLatencyMs:
      metrics.endToEndMs ?? metrics.fastDraftMs ?? current.totalLatencyMs,
    visibleLatencyMs: metrics.fastDraftMs,
    fastDraftLatencyMs: metrics.fastDraftMs,
    endToEndLatencyMs: metrics.endToEndMs,
    finalLatencyMs: metrics.finalMs
  };
}

function createPendingProvider(): CaptionCueProviderMetadata {
  return {
    provider: "pending",
    model: "",
    fallback: false,
    error: null
  };
}

function toCueState(
  segment: AsrSegment,
  translation: TranslationEvent | undefined,
  existing: CaptionCue | null
): CaptionCueState {
  if (translation?.error) {
    return existing?.translatedText ? "revising" : "drafting";
  }

  if (translation) {
    return segment.status === "final" ? "final" : existing ? "revising" : "translated";
  }

  return segment.status === "final" ? "drafting" : "listening";
}

function createCueFromSegment(
  segment: AsrSegment,
  translation: TranslationEvent | undefined,
  nowMs: number,
  cueHoldMs: number,
  sourceLanguageLabel: string,
  targetLanguageLabel: string
): CaptionCue {
  const translatedText = translation?.translatedText ?? "";
  const latency = createEmptyLatency(segment);

  if (translation) {
    Object.assign(latency, applyTranslationLatency(latency, translation, nowMs));
  }

  return {
    id: segment.id,
    sourceText: translation?.sourceText ?? segment.text,
    translatedText,
    state: toCueState(segment, translation, null),
    revision: Math.max(segment.revision, translation?.revision ?? 1),
    sourceLanguage: translation?.sourceLanguage ?? sourceLanguageLabel,
    targetLanguage: translation?.targetLanguage ?? targetLanguageLabel,
    startedAtMs: segment.startedAtMs,
    updatedAtMs: Math.max(segment.updatedAtMs, translation?.createdAtMs ?? 0),
    expiresAtMs: nowMs + cueHoldMs,
    revised: false,
    revisionProvenance: translation?.historyBackfill ? "history-backfill" : "initial",
    historyBackfill: Boolean(translation?.historyBackfill),
    rollbackGuardStartedAtMs: segment.startedAtMs,
    latency,
    provider: translation
      ? {
          provider: translation.provider,
          model: translation.model,
          fallback: translation.fallback,
          error: translation.error
        }
      : createPendingProvider()
  };
}

function reviseCue(
  existing: CaptionCue,
  segment: AsrSegment,
  translation: TranslationEvent | undefined,
  nowMs: number,
  cueHoldMs: number
): CaptionCue {
  const translatedText = translation?.translatedText ?? existing.translatedText;
  const revision = Math.max(existing.revision, segment.revision, translation?.revision ?? 1);
  const asrLatency = segment.latencyMs ?? existing.latency.asrLatencyMs;
  const baseLatency: CaptionCueLatency = {
    ...existing.latency,
    asrLatencyMs: asrLatency,
    audioEvidenceEndAtMs:
      existing.latency.audioEvidenceEndAtMs ?? segment.audioEvidenceEndAtMs,
    asrReceivedAtMs: existing.latency.asrReceivedAtMs ?? segment.asrReceivedAtMs
  };
  const latency = translation
    ? applyTranslationLatency(baseLatency, translation, nowMs)
    : baseLatency;

  return {
    ...existing,
    sourceText: translation?.sourceText ?? segment.text,
    translatedText,
    state: toCueState(segment, translation, existing),
    revision,
    updatedAtMs: Math.max(existing.updatedAtMs, segment.updatedAtMs, translation?.createdAtMs ?? 0),
    expiresAtMs: nowMs + cueHoldMs,
    revised: revision > existing.revision || existing.sourceText !== segment.text || Boolean(translation),
    revisionProvenance: translation?.historyBackfill
      ? "history-backfill"
      : segment.status === "final" && existing.state !== "final"
        ? "asr-finalization"
        : translation
          ? "translation-correction"
          : "asr-partial-correction",
    historyBackfill: existing.historyBackfill || Boolean(translation?.historyBackfill),
    rollbackGuardStartedAtMs: Math.max(existing.rollbackGuardStartedAtMs, segment.startedAtMs),
    latency,
    provider: translation
      ? {
          provider: translation.provider,
          model: translation.model,
          fallback: translation.fallback,
          error: translation.error
        }
      : existing.provider
  };
}

function pushHistory(history: CaptionCue[], cue: CaptionCue | null, limit: number): CaptionCue[] {
  if (!cue) {
    return history;
  }

  const withoutCue = history.filter((item) => item.id !== cue.id);
  return [cue, ...withoutCue].slice(0, limit);
}

function getLatestTranslationBySegment(events: TranslationEvent[]): Map<string, TranslationEvent> {
  const bySegment = new Map<string, TranslationEvent>();

  events.forEach((event) => {
    const existing = bySegment.get(event.segmentId);
    if (
      !existing ||
      event.revision > existing.revision ||
      (event.revision === existing.revision && event.createdAtMs > existing.createdAtMs)
    ) {
      bySegment.set(event.segmentId, event);
    }
  });

  return bySegment;
}

function getLatestRefinementBySegment(
  events: SubtitleRefinementEvent[] = []
): Map<string, SubtitleRefinementEvent> {
  const bySegment = new Map<string, SubtitleRefinementEvent>();

  events.forEach((event) => {
    const existing = bySegment.get(event.segmentId);
    if (
      !existing ||
      event.revision > existing.revision ||
      (event.revision === existing.revision && event.createdAtMs > existing.createdAtMs)
    ) {
      bySegment.set(event.segmentId, event);
    }
  });

  return bySegment;
}

function applyRefinementToCue(
  cue: CaptionCue | null,
  refinement: SubtitleRefinementEvent | undefined,
  nowMs: number,
  cueHoldMs: number
): CaptionCue | null {
  if (!cue || !refinement || cue.id !== refinement.segmentId || cue.revision > refinement.revision + 4) {
    return cue;
  }

  return {
    ...cue,
    sourceText: refinement.refinedSourceText || cue.sourceText,
    translatedText: refinement.refinedTranslatedText || cue.translatedText,
    state: cue.state === "final" ? "final" : "revising",
    revision: Math.max(cue.revision + 1, refinement.revision),
    updatedAtMs: Math.max(cue.updatedAtMs, refinement.createdAtMs),
    expiresAtMs: nowMs + cueHoldMs,
    revised: true,
    latency: {
      ...cue.latency,
      refinementLatencyMs: refinement.latencyMs,
      refinementVisibleAtMs: refinement.refinementVisibleAtMs ?? nowMs
    },
    provider: {
      provider: refinement.provider,
      model: refinement.model,
      fallback: refinement.fallback,
      error: refinement.error
    }
  };
}

export function updateCaptionCueSnapshot(input: CaptionCueUpdateInput): CaptionCueSnapshot {
  const cueHoldMs = input.cueHoldMs ?? DEFAULT_CUE_HOLD_MS;
  const historyLimit = input.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const sourceLanguageLabel = input.sourceLanguageLabel ?? "原文";
  const targetLanguageLabel = input.targetLanguageLabel ?? "译文";
  const latestSegment = [...input.asrSegments].sort(
    (left, right) => right.updatedAtMs - left.updatedAtMs
  )[0];

  let active = input.current.active;
  let previous = input.current.previous;
  let history = input.current.history;

  if (!latestSegment) {
    if (active && active.expiresAtMs <= input.nowMs) {
      history = pushHistory(history, active, historyLimit);
      previous = active;
      active = null;
    }

    return { active, previous, history };
  }

  const translations = getLatestTranslationBySegment(input.translationEvents);
  const refinements = getLatestRefinementBySegment(input.refinementEvents);
  const translation = translations.get(latestSegment.id);
  const refinement = refinements.get(latestSegment.id);
  const shouldBackfillHistory = Boolean(
    active &&
      active.id !== latestSegment.id &&
      (translation?.historyBackfill || latestSegment.startedAtMs < active.rollbackGuardStartedAtMs)
  );

  if (active && shouldBackfillHistory) {
    const existingHistoryCue =
      history.find((cue) => cue.id === latestSegment.id) ??
      (previous?.id === latestSegment.id ? previous : null);
    let historyCue = existingHistoryCue
      ? reviseCue(existingHistoryCue, latestSegment, translation, input.nowMs, cueHoldMs)
      : createCueFromSegment(
          latestSegment,
          translation,
          input.nowMs,
          cueHoldMs,
          sourceLanguageLabel,
          targetLanguageLabel
        );
    historyCue = {
      ...historyCue,
      historyBackfill: true,
      revisionProvenance: "history-backfill"
    };
    historyCue = applyRefinementToCue(historyCue, refinement, input.nowMs, cueHoldMs) ?? historyCue;
    history = pushHistory(history, historyCue, historyLimit);
    if (previous?.id === historyCue.id) {
      previous = historyCue;
    }
    return { active, previous, history };
  }

  if (active?.id === latestSegment.id) {
    active = reviseCue(active, latestSegment, translation, input.nowMs, cueHoldMs);
    active = applyRefinementToCue(active, refinement, input.nowMs, cueHoldMs);
    return { active, previous, history };
  }

  if (active) {
    previous = active;
    history = pushHistory(history, active, historyLimit);
  }

  active = createCueFromSegment(
    latestSegment,
    translation,
    input.nowMs,
    cueHoldMs,
    sourceLanguageLabel,
    targetLanguageLabel
  );
  active = applyRefinementToCue(active, refinement, input.nowMs, cueHoldMs);

  return { active, previous, history };
}
