import type { TranslationClient, TranslationEvent, TranslationRequest } from "./types";

type TranslationProvider = TranslationEvent["provider"];

interface TranslationMetadata {
  provider: TranslationProvider;
  model: string;
  error: string | null;
  fallback: boolean;
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
    return request.segment.status === "partial"
      ? `正在整理译文：${request.segment.text}`
      : request.segment.text;
  }

  return request.segment.status === "partial"
    ? `Draft translation: ${request.segment.text}`
    : request.segment.text;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "真实翻译服务调用失败。";
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
    id: `translation-${request.segment.id}-${request.segment.status}-${request.segment.revision}`,
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
    latencyMs,
    contextSize: request.context.length,
    provider: metadata.provider,
    model: metadata.model,
    error: metadata.error,
    fallback: metadata.fallback
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

function createFallbackTranslationEvent(
  request: TranslationRequest,
  latencyMs: number,
  provider: TranslationProvider,
  model: string,
  error: unknown
): TranslationEvent {
  return createBaseTranslationEvent(request, request.segment.text, latencyMs, {
    provider,
    model,
    error: getErrorMessage(error),
    fallback: true
  });
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
  const api = window.simultaneousInterpretation;
  const health = await getTranslationProviderHealth();
  const provider = health?.config.translationProvider ?? "mock";
  const model = health?.config.translationModel ?? request.languagePair.translationModel;

  if (provider === "mock" || request.segment.status !== "final") {
    return createMockTranslationEvent(request);
  }

  const startedAtMs = Date.now();

  if (!api?.translateText) {
    return createFallbackTranslationEvent(
      request,
      Date.now() - startedAtMs,
      provider,
      model,
      new Error("当前运行环境没有暴露翻译接口。")
    );
  }

  try {
    const response = await api.translateText({
      text: request.segment.text,
      sourceLanguage: request.languagePair.source.translationLocale,
      targetLanguage: request.languagePair.target.translationLocale,
      model,
      context: request.context
    });

    return createBaseTranslationEvent(request, response.text, response.latencyMs, {
      provider: response.provider,
      model: response.model,
      error: null,
      fallback: false
    });
  } catch (error) {
    return createFallbackTranslationEvent(
      request,
      Date.now() - startedAtMs,
      provider,
      model,
      error
    );
  }
}

export function createTranslationClient(): TranslationClient {
  return {
    translate(request: TranslationRequest) {
      return createProviderTranslationEvent(request);
    }
  };
}
