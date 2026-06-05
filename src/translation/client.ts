import type { TranslationClient, TranslationRequest } from "./types";
import type { TranslationEvent } from "./types";

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
  "临时识别结果可能在最终事件到达前继续更新。":
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

function createBaseTranslationEvent(
  request: TranslationRequest,
  translatedText: string,
  latencyMs: number
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
    contextSize: request.context.length
  };
}

function createMockTranslationEvent(request: TranslationRequest) {
  const dictionary =
    request.languagePair.target.code === "zh-CN" ? ENGLISH_TO_CHINESE : CHINESE_TO_ENGLISH;
  const translatedText = dictionary[request.segment.text] ?? createFallbackTranslation(request);
  const latencyMs = 420 + request.context.length * 60;

  return createBaseTranslationEvent(request, translatedText, latencyMs);
}

async function createProviderTranslationEvent(request: TranslationRequest) {
  const api = window.simultaneousInterpretation;

  if (!api?.translateText || request.segment.status !== "final") {
    return createMockTranslationEvent(request);
  }

  try {
    const response = await api.translateText({
      text: request.segment.text,
      sourceLanguage: request.languagePair.source.translationLocale,
      targetLanguage: request.languagePair.target.translationLocale,
      model: request.languagePair.translationModel,
      context: request.context
    });

    return createBaseTranslationEvent(request, response.text, response.latencyMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "真实翻译服务调用失败。";
    return createBaseTranslationEvent(request, `翻译服务暂不可用：${message}`, 0);
  }
}

export function createTranslationClient(): TranslationClient {
  return {
    translate(request: TranslationRequest) {
      if (import.meta.env.VITE_AI_PROVIDER === "openai") {
        return createProviderTranslationEvent(request);
      }

      return Promise.resolve(createMockTranslationEvent(request));
    }
  };
}
