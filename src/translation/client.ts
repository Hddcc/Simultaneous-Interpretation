import type { TranslationClient, TranslationRequest } from "./types";

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
  const contextHint =
    request.context.length > 0 ? `（已参考 ${request.context.length} 条上下文）` : "";

  if (request.languagePair.target.code === "zh-CN") {
    return `${request.segment.text}${contextHint}`;
  }

  return `${request.segment.text}${contextHint ? ` ${contextHint}` : ""}`;
}

export function createTranslationClient(): TranslationClient {
  return {
    translate(request: TranslationRequest) {
      const dictionary =
        request.languagePair.target.code === "zh-CN" ? ENGLISH_TO_CHINESE : CHINESE_TO_ENGLISH;
      const translatedText =
        dictionary[request.segment.text] ?? createFallbackTranslation(request);
      const latencyMs = 420 + request.context.length * 60;
      const createdAtMs = Date.now();

      return {
        id: `translation-${request.segment.id}-${request.segment.revision}`,
        segmentId: request.segment.id,
        sourceText: request.segment.text,
        translatedText,
        languagePairId: request.languagePair.id,
        sourceLanguage: request.languagePair.source.label,
        targetLanguage: request.languagePair.target.label,
        status: "translated",
        revision: request.segment.revision,
        createdAtMs,
        latencyMs,
        contextSize: request.context.length
      };
    }
  };
}
