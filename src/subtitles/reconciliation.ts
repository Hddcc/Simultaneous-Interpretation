import type { AsrSegment } from "../asr/types";
import type {
  SubtitleSegment,
  TranslationContextItem,
  TranslationEvent
} from "../translation/types";

export const DEFAULT_REVISION_WINDOW = 4;

interface ReconcileSubtitleSegmentsInput {
  current: SubtitleSegment[];
  translationEvents: TranslationEvent[];
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

  if (provenance === "translation-correction" || provenance === "manual-fallback") {
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

    if (existing && !withinRevisionWindow) {
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

    byId.set(event.segmentId, {
      id: event.segmentId,
      sourceText: event.sourceText,
      translatedText: event.translatedText,
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
      totalLatencyMs: asrSegment.latencyMs + event.latencyMs,
      contextSize: event.contextSize,
      translationProvider: event.provider,
      translationModel: event.model,
      translationError: event.error,
      translationFallback: event.fallback,
      revised: Boolean(existing)
    });

    applied.push({
      segmentId: event.segmentId,
      revision,
      provenance
    });
  });

  return {
    segments: Array.from(byId.values())
      .sort((left, right) => right.startedAtMs - left.startedAtMs)
      .slice(0, 6),
    applied
  };
}
