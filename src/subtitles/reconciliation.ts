import type { AsrSegment } from "../asr/types";
import { calculateRealtimeLatencies } from "../realtime/latency";
import type {
  SubtitleRefinementEvent,
  SubtitleSegment,
  TranslationContextItem,
  TranslationEvent
} from "../translation/types";

export const DEFAULT_REVISION_WINDOW = 4;

interface ReconcileSubtitleSegmentsInput {
  current: SubtitleSegment[];
  translationEvents: TranslationEvent[];
  refinementEvents?: SubtitleRefinementEvent[];
  asrSegments: AsrSegment[];
  revisionWindow: number;
  providerConnectionState?: string | null;
}

interface ReconcileSubtitleSegmentsResult {
  segments: SubtitleSegment[];
  applied: Array<{
    segmentId: string;
    revision: number;
    provenance: SubtitleSegment["revisionProvenance"];
  }>;
}

export function getSubtitleContextItems(
  segments: SubtitleSegment[],
  limit: number
): TranslationContextItem[] {
  return segments.slice(0, limit).map((item) => ({
    segmentId: item.id,
    sourceText: item.sourceText,
    translatedText: item.translatedText
  }));
}

function getRevisionReason(
  provenance: SubtitleSegment["revisionProvenance"]
): SubtitleSegment["revisionReason"] {
  if (
    provenance === "asr-partial-correction" ||
    provenance === "asr-finalization" ||
    provenance === "provider-reconnect"
  ) {
    return "asr-correction";
  }

  if (
    provenance === "translation-correction" ||
    provenance === "refinement-correction" ||
    provenance === "manual-fallback" ||
    provenance === "history-backfill" ||
    provenance === "active-lane-supersession"
  ) {
    return "translation-correction";
  }

  return "initial";
}

function hasProviderRecoveryContext(providerConnectionState?: string | null): boolean {
  return providerConnectionState === "reconnecting" || providerConnectionState === "degraded";
}

function getRevisionProvenance(
  existing: SubtitleSegment | undefined,
  event: TranslationEvent,
  asrSegment: AsrSegment,
  providerConnectionState?: string | null
): SubtitleSegment["revisionProvenance"] {
  if (event.historyBackfill) {
    return "history-backfill";
  }

  if (!existing) {
    return "initial";
  }

  const sourceChanged = existing.sourceText !== event.sourceText;
  const translationChanged = existing.translatedText !== event.translatedText;
  const finalized = existing.status === "partial" && asrSegment.status === "final";

  if (
    (sourceChanged || translationChanged || finalized) &&
    hasProviderRecoveryContext(providerConnectionState)
  ) {
    return "provider-reconnect";
  }

  if (event.fallback && (!existing.translationFallback || translationChanged)) {
    return "manual-fallback";
  }

  if (finalized) {
    return "asr-finalization";
  }

  if (sourceChanged) {
    return "asr-partial-correction";
  }

  return "translation-correction";
}

function hasSubtitleChange(
  existing: SubtitleSegment,
  event: TranslationEvent,
  asrSegment: AsrSegment
): boolean {
  return (
    existing.sourceText !== event.sourceText ||
    existing.translatedText !== event.translatedText ||
    existing.status !== asrSegment.status ||
    existing.translationProvider !== event.provider ||
    existing.translationModel !== event.model ||
    existing.translationFallback !== event.fallback ||
    existing.translationError !== event.error
  );
}

export function reconcileSubtitleSegments(
  input: ReconcileSubtitleSegmentsInput
): ReconcileSubtitleSegmentsResult {
  const byId = new Map(input.current.map((segment) => [segment.id, segment]));
  const applied: ReconcileSubtitleSegmentsResult["applied"] = [];

  input.translationEvents.forEach((event) => {
    const asrSegment = input.asrSegments.find((segment) => segment.id === event.segmentId);

    if (!asrSegment) {
      return;
    }

    const existing = byId.get(event.segmentId);
    const currentIndex = input.current.findIndex((segment) => segment.id === event.segmentId);
    const withinRevisionWindow =
      !existing || (currentIndex >= 0 && currentIndex < input.revisionWindow);
    const eligibleHistoryBackfill = Boolean(event.historyBackfill && asrSegment.status === "final");

    if (existing && !withinRevisionWindow && !eligibleHistoryBackfill) {
      return;
    }

    if (existing && !hasSubtitleChange(existing, event, asrSegment)) {
      return;
    }

    const provenance = getRevisionProvenance(
      existing,
      event,
      asrSegment,
      input.providerConnectionState
    );
    const revision = existing ? existing.revision + 1 : Math.max(1, event.revision);
    const status = asrSegment.status === "final" ? "final" : "partial";
    const hasValidTranslation = !event.error && Boolean(event.translatedText.trim());
    const timing = {
      audioEvidenceEndAtMs:
        existing?.audioEvidenceEndAtMs ?? event.audioEvidenceEndAtMs ?? asrSegment.audioEvidenceEndAtMs,
      asrReceivedAtMs:
        existing?.asrReceivedAtMs ?? event.asrReceivedAtMs ?? asrSegment.asrReceivedAtMs,
      translationEligibleAtMs:
        existing?.translationEligibleAtMs ?? event.translationEligibleAtMs ?? null,
      translationRequestedAtMs:
        existing?.translationRequestedAtMs ?? event.translationRequestedAtMs ?? null,
      firstDraftReceivedAtMs:
        existing?.firstDraftReceivedAtMs ??
        (hasValidTranslation ? event.firstDraftReceivedAtMs ?? null : null),
      firstDraftVisibleAtMs:
        existing?.firstDraftVisibleAtMs ??
        (hasValidTranslation ? event.firstDraftVisibleAtMs ?? null : null),
      finalVisibleAtMs: hasValidTranslation
        ? event.finalVisibleAtMs ?? existing?.finalVisibleAtMs ?? null
        : existing?.finalVisibleAtMs ?? null,
      refinementVisibleAtMs: existing?.refinementVisibleAtMs ?? null
    };
    const latency = calculateRealtimeLatencies(timing);

    byId.set(event.segmentId, {
      id: event.segmentId,
      sourceText: event.sourceText,
      translatedText: hasValidTranslation ? event.translatedText : existing?.translatedText ?? "",
      sourceLanguage: event.sourceLanguage,
      targetLanguage: event.targetLanguage,
      status,
      revision,
      revisionReason: getRevisionReason(provenance),
      revisionProvenance: provenance,
      startedAtMs: asrSegment.startedAtMs,
      endedAtMs: asrSegment.endedAtMs,
      updatedAtMs: event.createdAtMs,
      asrLatencyMs: asrSegment.latencyMs,
      translationLatencyMs: event.latencyMs,
      totalLatencyMs:
        latency.endToEndMs ?? latency.fastDraftMs ?? asrSegment.latencyMs + event.latencyMs,
      contextSize: event.contextSize,
      translationProvider: event.provider,
      translationModel: event.model,
      translationError: event.error,
      translationFallback: event.fallback,
      translationFailure: event.failure ?? null,
      translationAttempt: event.attempt ?? "initial",
      ...timing,
      fastDraftLatencyMs: latency.fastDraftMs,
      endToEndLatencyMs: latency.endToEndMs,
      finalLatencyMs: latency.finalMs,
      historyBackfill: existing?.historyBackfill || eligibleHistoryBackfill,
      backfillAtMs: eligibleHistoryBackfill ? event.createdAtMs : existing?.backfillAtMs ?? null,
      rollbackGuardStartedAtMs: existing?.rollbackGuardStartedAtMs ?? asrSegment.startedAtMs,
      revised: Boolean(existing)
    });

    applied.push({
      segmentId: event.segmentId,
      revision,
      provenance
    });
  });

  input.refinementEvents?.forEach((event) => {
    const existing = byId.get(event.segmentId);
    const currentIndex = input.current.findIndex((segment) => segment.id === event.segmentId);
    const withinRevisionWindow =
      existing &&
      currentIndex >= 0 &&
      (currentIndex < input.revisionWindow || existing.historyBackfill);

    if (!existing || !withinRevisionWindow || !existing.translatedText.trim() || existing.translationError) {
      return;
    }

    const sourceChanged = existing.sourceText !== event.refinedSourceText;
    const translationChanged = existing.translatedText !== event.refinedTranslatedText;

    if (!sourceChanged && !translationChanged && existing.refinementError === event.error) {
      return;
    }

    const revision = existing.revision + 1;
    const refinementVisibleAtMs = event.refinementVisibleAtMs ?? event.createdAtMs;
    const refinementLatency = calculateRealtimeLatencies({
      firstDraftVisibleAtMs: existing.firstDraftVisibleAtMs,
      refinementVisibleAtMs
    }).refinementMs;

    byId.set(event.segmentId, {
      ...existing,
      sourceText: event.refinedSourceText || existing.sourceText,
      translatedText: event.refinedTranslatedText || existing.translatedText,
      revision,
      revisionReason: "translation-correction",
      revisionProvenance: "refinement-correction",
      updatedAtMs: event.createdAtMs,
      refinementVisibleAtMs,
      refinementProvider: event.provider,
      refinementModel: event.model,
      refinementLatencyMs: refinementLatency ?? event.latencyMs,
      refinementError: event.error,
      refinementFallback: event.fallback,
      revised: true
    });

    applied.push({
      segmentId: event.segmentId,
      revision,
      provenance: "refinement-correction"
    });
  });

  return {
    segments: Array.from(byId.values())
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, 6),
    applied
  };
}
