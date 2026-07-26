import type { NormalizedAudioChunk } from "../audio/types";
import type { AsrClient, AsrConfig, AsrEvent, AsrLanguagePair } from "./types";

const ENGLISH_SEGMENTS = [
  "Welcome to today's session about realtime speech systems.",
  "The pipeline receives small audio chunks and publishes source text quickly.",
  "Partial results may change before the final recognition event arrives.",
  "This design keeps captions responsive while preserving room for correction."
];

const CHINESE_SEGMENTS = [
  "欢迎来到今天关于实时语音系统的分享。",
  "这条链路会接收小段音频，并快速发布原文字幕。",
  "临时识别结果可能在最终事件到达前继续更新。",
  "这个设计能让字幕保持流畅，并为后续修正留出空间。"
];

function usesEnglishSource(languagePair: AsrLanguagePair): boolean {
  return languagePair.source.code.startsWith("en");
}

function buildPartialText(fullText: string, revision: number, englishSource: boolean): string {
  if (!englishSource) {
    const targetLength = Math.max(4, Math.ceil((fullText.length * revision) / 3));
    return fullText.slice(0, targetLength);
  }

  const words = fullText.split(" ");
  const targetLength = Math.max(3, Math.ceil((words.length * revision) / 3));
  return words.slice(0, targetLength).join(" ");
}

export function createStreamingAsrClient(config: AsrConfig): AsrClient {
  const finalizedSegments = new Set<string>();

  return {
    getConfig() {
      return config;
    },
    reset() {
      finalizedSegments.clear();
    },
    pushChunk(chunk: NormalizedAudioChunk, languagePair: AsrLanguagePair): AsrEvent[] {
      const segmentIndex = Math.floor(chunk.sequence / 3);
      const revision = (chunk.sequence % 3) + 1;
      const status = revision === 3 ? "final" : "partial";
      const segmentId = `asr-segment-${segmentIndex + 1}`;

      if (finalizedSegments.has(segmentId)) {
        return [];
      }

      if (status === "final") {
        finalizedSegments.add(segmentId);
      }

      const englishSource = usesEnglishSource(languagePair);
      const fullText = englishSource
        ? ENGLISH_SEGMENTS[segmentIndex % ENGLISH_SEGMENTS.length]
        : CHINESE_SEGMENTS[segmentIndex % CHINESE_SEGMENTS.length];
      const text = status === "final" ? fullText : buildPartialText(fullText, revision, englishSource);
      const receivedAtMs = Date.now();
      const latencyMs = 260 + revision * 80 + Math.round((1 - chunk.volume) * 120);
      const audioEvidenceEndAtMs =
        chunk.payloadMetadata.producedAtMs || Math.max(0, receivedAtMs - latencyMs);

      return [
        {
          id: `${segmentId}-${status}-${revision}`,
          segmentId,
          chunkId: chunk.id,
          sourceType: chunk.sourceType,
          sequence: chunk.sequence,
          audioStartMs: chunk.timestampMs,
          audioEndMs: chunk.timestampMs + chunk.durationMs,
          text,
          status,
          revision,
          receivedAtMs,
          audioEvidenceEndAtMs,
          asrReceivedAtMs: receivedAtMs,
          timingCorrelation: "segment-revision",
          latencyMs
        }
      ];
    }
  };
}
