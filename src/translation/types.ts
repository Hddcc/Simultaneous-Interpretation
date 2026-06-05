import type { AsrSegment } from "../asr/types";
import type { LanguagePair } from "../language/pairs";

export interface TranslationContextItem {
  segmentId: string;
  sourceText: string;
  translatedText: string;
}

export interface TranslationRequest {
  segment: AsrSegment;
  languagePair: LanguagePair;
  context: TranslationContextItem[];
}

export interface TranslationEvent {
  id: string;
  segmentId: string;
  sourceText: string;
  translatedText: string;
  languagePairId: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: "partial" | "translated" | "revised";
  revision: number;
  revisionReason: "initial" | "asr-correction" | "translation-correction";
  createdAtMs: number;
  latencyMs: number;
  contextSize: number;
}

export interface SubtitleSegment {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: "partial" | "final" | "revised";
  revision: number;
  revisionReason: "initial" | "asr-correction" | "translation-correction";
  startedAtMs: number;
  endedAtMs: number;
  updatedAtMs: number;
  asrLatencyMs: number;
  translationLatencyMs: number;
  totalLatencyMs: number;
  contextSize: number;
  revised: boolean;
}

export interface TranslationClient {
  translate(request: TranslationRequest): Promise<TranslationEvent>;
}
