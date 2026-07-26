import type {
  TranslationClient,
  TranslationEvent,
  TranslationFailureMetadata,
  TranslationRequest
} from "./types";
import { validateTranslationText } from "./validation";

type TranslationProvider = TranslationEvent["provider"];

interface TranslationMetadata {
  provider: TranslationProvider;
  model: string;
  error: string | null;
  fallback: boolean;
  failure?: TranslationFailureMetadata | null;
}

const ENGLISH_TO_CHINESE: Record<string, string> = {
  "Welcome to today's session about realtime speech systems.":
    "欢迎来到今天关于实时语音系统的分享。",
  "The pipeline receives small audio chunks and publishes source text quickly.":
    "这条链路会接收小段音频，并快速发布原文字幕。",
  "Partial results may change before the final recognition event arrives.":
    "临时识别结果可能会在最终识别事件到达前继续变化。",
  "This design keeps captions responsive while preserving room for correction.":
    "这个设计让字幕保持快速响应，同时为后续修正留出空间。"
};

const CHINESE_TO_ENGLISH: Record<string, string> = {
  "欢迎来到今天关于实时语音系统的分享。":
    "Welcome to today's session about realtime speech systems.",
  "这条链路会接收小段音频，并快速发布原文字幕。":
    "The pipeline receives small audio chunks and publishes source text quickly.",
  "临时识别结果可能会在最终事件到达前继续更新。":
    "Partial recognition results may continue updating before the final event arrives.",
  "这个设计能让字幕保持流畅，并为后续修正留出空间。":
    "This design keeps captions smooth and leaves room for later corrections."
};

function createFallbackTranslation(request: TranslationRequest): string {
  if (request.languagePair.target.code === "zh-CN") {
    return `模拟译文：${request.segment.text}`;
  }

  return `Draft translation: ${request.segment.text}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "真实翻译服务调用失败。";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  const error = new Error("translation request aborted");
  error.name = "AbortError";
  throw error;
}

function createBaseTranslationEvent(
  request: TranslationRequest,
  translatedText: string,
  latencyMs: number,
  metadata: TranslationMetadata
): TranslationEvent {
  const createdAtMs = Date.now();
  const revisionReason =
    request.segment.revision === 1
      ? "initial"
      : request.segment.status === "final"
        ? "translation-correction"
        : "asr-correction";

  return {
    id: `translation-${request.segment.id}-${request.segment.status}-${request.segment.revision}-${request.attempt ?? "initial"}`,
    segmentId: request.segment.id,
    sourceText: request.segment.text,
    translatedText,
    languagePairId: request.languagePair.id,
    sourceLanguage: request.languagePair.source.label,
    targetLanguage: request.languagePair.target.label,
    status: request.segment.status === "final" ? "translated" : "partial",
    revision: request.segment.revision,
    revisionReason,
    createdAtMs,
    audioEvidenceEndAtMs: request.segment.audioEvidenceEndAtMs,
    asrReceivedAtMs: request.segment.asrReceivedAtMs,
    translationEligibleAtMs: request.translationEligibleAtMs ?? request.segment.updatedAtMs,
    translationRequestedAtMs: request.translationRequestedAtMs ?? createdAtMs - latencyMs,
    firstDraftReceivedAtMs: createdAtMs,
    firstDraftVisibleAtMs: null,
    finalVisibleAtMs: null,
    refinementVisibleAtMs: null,
    latencyMs,
    contextSize: request.context.length,
    provider: metadata.provider,
    model: metadata.model,
    error: metadata.error,
    fallback: metadata.fallback,
    failure: metadata.failure ?? null,
    attempt: request.attempt ?? "initial",
    streaming: false,
    complete: true
  };
}

function createMockTranslationEvent(request: TranslationRequest): TranslationEvent {
  const dictionary =
    request.languagePair.target.code === "zh-CN" ? ENGLISH_TO_CHINESE : CHINESE_TO_ENGLISH;
  const translatedText = dictionary[request.segment.text] ?? createFallbackTranslation(request);
  const latencyMs = 420 + request.context.length * 60;

  return createBaseTranslationEvent(request, translatedText, latencyMs, {
    provider: "mock",
    model: "mock-bilingual-translator",
    error: null,
    fallback: false
  });
}

function createFailureTranslationEvent(
  request: TranslationRequest,
  latencyMs: number,
  provider: TranslationProvider,
  model: string,
  failure: TranslationFailureMetadata
): TranslationEvent {
  return createBaseTranslationEvent(request, "", latencyMs, {
    provider,
    model,
    error: failure.message,
    fallback: true,
    failure
  });
}

function failureFromError(error: unknown): TranslationFailureMetadata {
  return {
    category: error instanceof SyntaxError ? "invalid-response" : "network",
    message: getErrorMessage(error),
    httpStatus: null,
    providerCode: null
  };
}

async function getTranslationProviderHealth(): Promise<ProviderHealth | null> {
  const api = window.simultaneousInterpretation;

  if (!api?.getProviderHealth) {
    return null;
  }

  try {
    return await api.getProviderHealth();
  } catch {
    return null;
  }
}

async function createProviderTranslationEvent(request: TranslationRequest): Promise<TranslationEvent> {
  throwIfAborted(request.signal);
  const api = window.simultaneousInterpretation;
  const health = await getTranslationProviderHealth();
  throwIfAborted(request.signal);
  const provider = health?.config.translationProvider ?? "mock";
  const fastDraft = request.lane === "active" && request.attempt !== "final-recovery";
  const model =
    (fastDraft ? health?.config.fastDraftModel : health?.config.translationModel) ??
    request.languagePair.translationModel;
  const stream = fastDraft && Boolean(health?.config.fastDraftStreaming);

  if (provider === "mock") {
    return createMockTranslationEvent(request);
  }

  const startedAtMs = Date.now();
  const requestId = `translation-${request.segment.id}-${request.segment.revision}-${startedAtMs}`;

  if (!api?.translateText) {
    return createFailureTranslationEvent(
      request,
      Date.now() - startedAtMs,
      provider,
      model,
      {
        category: "invalid-response",
        message: "当前运行环境没有暴露翻译接口。",
        httpStatus: null,
        providerCode: null
      }
    );
  }

  const cancel = () => api.cancelTranslation?.(requestId);
  let unsubscribeDraft: (() => void) | undefined;

  try {
    request.signal?.addEventListener("abort", cancel, { once: true });
    if (stream && request.onDraft && api.onTranslationDraft) {
      unsubscribeDraft = api.onTranslationDraft((draft) => {
        if (draft.requestId !== requestId || draft.complete || request.signal?.aborted) {
          return;
        }
        if (!validateTranslationText(request.segment.text, draft.text, request.languagePair).valid) {
          return;
        }
        request.onDraft?.({
          ...createBaseTranslationEvent(request, draft.text, draft.latencyMs, {
            provider: draft.provider,
            model: draft.model,
            error: null,
            fallback: false
          }),
          createdAtMs: draft.receivedAtMs,
          firstDraftReceivedAtMs: draft.receivedAtMs,
          streaming: true,
          complete: false
        });
      });
    }
    const response = await api.translateText({
      requestId,
      stream,
      fastDraft,
      minimumReadableCharacters: 6,
      text: request.segment.text,
      sourceLanguage: request.languagePair.source.translationLocale,
      targetLanguage: request.languagePair.target.translationLocale,
      model,
      context: request.context
    });
    throwIfAborted(request.signal);

    if (response.ok === false) {
      if (response.failure.category === "cancelled") {
        const error = new Error(response.failure.message);
        error.name = "AbortError";
        throw error;
      }
      return createFailureTranslationEvent(
        request,
        response.latencyMs,
        response.provider,
        response.model,
        response.failure
      );
    }

    if (!validateTranslationText(request.segment.text, response.text, request.languagePair).valid) {
      return createFailureTranslationEvent(request, response.latencyMs, response.provider, response.model, {
        category: "untranslated-output",
        message: "翻译服务返回了未转换为目标语言的文本。",
        httpStatus: null,
        providerCode: null
      });
    }

    return {
      ...createBaseTranslationEvent(request, response.text, response.latencyMs, {
        provider: response.provider,
        model: response.model,
        error: null,
        fallback: false
      }),
      streaming: stream,
      complete: true
    };
  } catch (error) {
    if (request.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      throwIfAborted(request.signal);
      throw error;
    }
    return createFailureTranslationEvent(
      request,
      Date.now() - startedAtMs,
      provider,
      model,
      failureFromError(error)
    );
  } finally {
    request.signal?.removeEventListener("abort", cancel);
    unsubscribeDraft?.();
  }
}

export function createTranslationClient(): TranslationClient {
  return {
    translate(request: TranslationRequest) {
      return createProviderTranslationEvent(request);
    }
  };
}
