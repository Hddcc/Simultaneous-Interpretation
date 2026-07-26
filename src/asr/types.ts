import type { AudioSourceType, NormalizedAudioChunk } from "../audio/types";

export type AiProvider = "mock" | "openai" | "custom";

export type AsrMode = "mock" | "provider";

export interface AsrConfig {
  provider: AiProvider;
  mode: AsrMode;
  model: string;
}

export type AsrEventStatus = "partial" | "final";

export type AsrTimingCorrelation = "provider-offset" | "segment-revision" | "missing";

export interface AsrTimingMetadata {
  audioEvidenceEndAtMs: number | null;
  asrReceivedAtMs: number;
  timingCorrelation: AsrTimingCorrelation;
}

export interface AsrEvent extends AsrTimingMetadata {
  id: string;
  segmentId: string;
  chunkId: string;
  sourceType: AudioSourceType;
  sequence: number;
  audioStartMs: number;
  audioEndMs: number;
  text: string;
  status: AsrEventStatus;
  revision: number;
  receivedAtMs: number;
  latencyMs: number;
}

export interface AsrSegment extends AsrTimingMetadata {
  id: string;
  sourceType: AudioSourceType;
  text: string;
  status: AsrEventStatus;
  startedAtMs: number;
  endedAtMs: number;
  updatedAtMs: number;
  latencyMs: number;
  revision: number;
}

export interface AsrLanguagePair {
  source: {
    code: string;
  };
}

export interface AsrClient {
  getConfig(): AsrConfig;
  reset(): void;
  pushChunk(chunk: NormalizedAudioChunk, languagePair: AsrLanguagePair): AsrEvent[];
}
