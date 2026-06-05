import type { AudioSourceType, NormalizedAudioChunk } from "../audio/types";
import type { LanguagePair } from "../language/pairs";

export type AiProvider = "mock" | "openai" | "custom";

export type AsrMode = "mock" | "provider";

export interface AsrConfig {
  provider: AiProvider;
  mode: AsrMode;
  model: string;
}

export type AsrEventStatus = "partial" | "final";

export interface AsrEvent {
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

export interface AsrSegment {
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

export interface AsrClient {
  getConfig(): AsrConfig;
  reset(): void;
  pushChunk(chunk: NormalizedAudioChunk, languagePair: LanguagePair): AsrEvent[];
}
