export type AudioSourceType = "system" | "microphone" | "file";

export type StreamStatus = "idle" | "ready" | "streaming" | "paused" | "error";

export interface AudioSourceOption {
  type: AudioSourceType;
  label: string;
  description: string;
}

export interface LocalMediaFile {
  path: string;
  name: string;
  size: number;
  extension: string;
}

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

export interface DesktopAudioSource {
  id: string;
  name: string;
}

export type AudioPayloadEncoding = "none" | "pcm16-base64";

export type AudioSampleFormat = "u8-time-domain" | "s16le";

export interface AudioPayload {
  encoding: AudioPayloadEncoding;
  sampleFormat: AudioSampleFormat;
  sampleRate: number;
  channels: number;
  frameCount: number;
  byteLength: number;
  durationMs: number;
  data: string;
}

export interface AudioPayloadMetadata {
  available: boolean;
  providerReady: boolean;
  encoding: AudioPayloadEncoding;
  sampleFormat: AudioSampleFormat;
  byteLength: number;
  frameCount: number;
  producedAtMs: number;
}

export interface AudioChunkQueueState {
  maxDepth: number;
  depth: number;
  dropped: number;
  lastSequence: number | null;
  lastPayloadBytes: number;
}

export interface NormalizedAudioChunk {
  id: string;
  sourceType: AudioSourceType;
  sequence: number;
  timestampMs: number;
  durationMs: number;
  sampleRate: number;
  channels: number;
  volume: number;
  status: "simulated" | "captured";
  fileName?: string;
  deviceLabel?: string;
  payload?: AudioPayload;
  payloadMetadata: AudioPayloadMetadata;
}

export interface AudioSessionState {
  sourceType: AudioSourceType;
  status: StreamStatus;
  selectedFile: LocalMediaFile | null;
  lastChunk: NormalizedAudioChunk | null;
  chunksProduced: number;
  volume: number;
  queue: AudioChunkQueueState;
  error: string | null;
}
