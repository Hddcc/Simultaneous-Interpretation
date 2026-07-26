import type { AudioSourceType } from "../audio/types";

export interface HistoryRecord {
  id: string;
  sessionId: string;
  segmentId: string;
  sourceType: AudioSourceType;
  languagePairId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  translationAvailable?: boolean;
  startedAtMs: number;
  endedAtMs: number;
  updatedAtMs: number;
  revised: boolean;
}

export interface HistoryStore {
  version: 1;
  records: HistoryRecord[];
}

export interface HistoryGroup {
  id: string;
  startedAtMs: number;
  endedAtMs: number;
  sourceText: string;
  translatedText: string;
  translationAvailable: boolean;
  revised: boolean;
  records: HistoryRecord[];
}
