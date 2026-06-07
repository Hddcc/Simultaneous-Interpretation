import type { AsrSegment } from "../asr/types";

export interface TranslationContextItem {
  segmentId: string;
  sourceText: string;
  translatedText: string;
}

export interface TranslationLanguagePair {
  id: string;
  source: {
    code: string;
    label: string;
    translationLocale: string;
  };
  target: {
    code: string;
    label: string;
    translationLocale: string;
  };
  translationModel: string;
}

export interface TranslationRequest {
  segment: AsrSegment;
  languagePair: TranslationLanguagePair;
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
  provider: "mock" | "openai" | "deepseek" | "custom";
  model: string;
  error: string | null;
  fallback: boolean;
}

export type SubtitleRevisionProvenance =
  | "initial"
  | "asr-partial-correction"
  | "asr-finalization"
  | "translation-correction"
  | "provider-reconnect"
  | "manual-fallback";

export interface SubtitleSegment {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  status: "partial" | "final" | "revised";
  revision: number;
  revisionReason: "initial" | "asr-correction" | "translation-correction";
  revisionProvenance: SubtitleRevisionProvenance;
  startedAtMs: number;
  endedAtMs: number;
  updatedAtMs: number;
  asrLatencyMs: number;
  translationLatencyMs: number;
  totalLatencyMs: number;
  contextSize: number;
  translationProvider: "mock" | "openai" | "deepseek" | "custom";
  translationModel: string;
  translationError: string | null;
  translationFallback: boolean;
  revised: boolean;
}

export interface TranslationClient {
  translate(request: TranslationRequest): Promise<TranslationEvent>;
}
