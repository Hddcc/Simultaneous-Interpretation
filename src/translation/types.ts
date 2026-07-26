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
  translationEligibleAtMs?: number;
  translationRequestedAtMs?: number;
  signal?: AbortSignal;
  lane?: "active" | "backfill";
  attempt?: TranslationAttempt;
  onDraft?: (event: TranslationEvent) => void;
}

export type TranslationAttempt = "initial" | "final-recovery";
export type TranslationFailureCategory =
  | "provider"
  | "network"
  | "invalid-response"
  | "untranslated-output"
  | "cancelled";

export interface TranslationFailureMetadata {
  category: TranslationFailureCategory;
  message: string;
  httpStatus: number | null;
  providerCode: string | null;
}

export interface RealtimePipelineTiming {
  audioEvidenceEndAtMs?: number | null;
  asrReceivedAtMs?: number | null;
  translationEligibleAtMs?: number | null;
  translationRequestedAtMs?: number | null;
  firstDraftReceivedAtMs?: number | null;
  firstDraftVisibleAtMs?: number | null;
  finalVisibleAtMs?: number | null;
  refinementVisibleAtMs?: number | null;
}

export interface TranslationEvent extends RealtimePipelineTiming {
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
  provider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
  model: string;
  error: string | null;
  fallback: boolean;
  failure?: TranslationFailureMetadata | null;
  attempt?: TranslationAttempt;
  recoveryScheduled?: boolean;
  lane?: "active" | "backfill";
  historyBackfill?: boolean;
  streaming?: boolean;
  complete?: boolean;
}

export type SubtitleRevisionProvenance =
  | "initial"
  | "asr-partial-correction"
  | "asr-finalization"
  | "translation-correction"
  | "refinement-correction"
  | "provider-reconnect"
  | "manual-fallback"
  | "active-lane-supersession"
  | "history-backfill";

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
  translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
  translationModel: string;
  translationError: string | null;
  translationFallback: boolean;
  translationFailure?: TranslationFailureMetadata | null;
  translationAttempt?: TranslationAttempt;
  refinementProvider?: RefinementProvider | null;
  refinementModel?: string | null;
  refinementLatencyMs?: number | null;
  refinementError?: string | null;
  refinementFallback?: boolean;
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
  historyBackfill: boolean;
  backfillAtMs: number | null;
  rollbackGuardStartedAtMs: number;
  revised: boolean;
}

export interface TranslationClient {
  translate(request: TranslationRequest): Promise<TranslationEvent>;
}

export type RefinementProvider = TranslationEvent["provider"];

export interface SubtitleRefinementRequest {
  segmentId: string;
  sourceText: string;
  translatedText: string;
  languagePair: TranslationLanguagePair;
  context: TranslationContextItem[];
  revision: number;
  status: "partial" | "final" | "revised";
  terminologyHints?: string[];
  firstDraftVisibleAtMs?: number | null;
}

export interface SubtitleRefinementEvent extends RealtimePipelineTiming {
  id: string;
  segmentId: string;
  sourceText: string;
  translatedText: string;
  refinedSourceText: string;
  refinedTranslatedText: string;
  languagePairId: string;
  sourceLanguage: string;
  targetLanguage: string;
  revision: number;
  createdAtMs: number;
  latencyMs: number;
  contextSize: number;
  provider: RefinementProvider;
  model: string;
  error: string | null;
  fallback: boolean;
  reason: string;
}

export interface SubtitleRefinementClient {
  refine(request: SubtitleRefinementRequest): Promise<SubtitleRefinementEvent>;
}
