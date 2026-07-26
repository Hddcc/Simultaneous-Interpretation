import type { AudioSourceType } from "../audio/types";
import type { SubtitleSegment } from "../translation/types";
import type { HistoryRecord } from "./types";

export interface HistoryProjectionContext {
  sessionId: string;
  captureEpoch: number;
  sourceType: AudioSourceType;
  languagePairId: string;
}

export function toHistoryRecords(
  segments: SubtitleSegment[],
  context: HistoryProjectionContext
): HistoryRecord[] {
  return segments
    .filter((segment) => segment.translatedText.trim())
    .slice(0, 6)
    .map((segment) => {
      const segmentId = `${context.captureEpoch}:${segment.id}`;
      return {
        id: `${context.sessionId}:${segmentId}`,
        sessionId: context.sessionId,
        segmentId,
        sourceType: context.sourceType,
        languagePairId: context.languagePairId,
        sourceLanguage: segment.sourceLanguage,
        targetLanguage: segment.targetLanguage,
        sourceText: segment.sourceText,
        translatedText: segment.translatedText,
        startedAtMs: segment.startedAtMs,
        endedAtMs: segment.endedAtMs,
        updatedAtMs: segment.updatedAtMs,
        revised: segment.revised
      };
    });
}
