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
}

export interface AudioSessionState {
  sourceType: AudioSourceType;
  status: StreamStatus;
  selectedFile: LocalMediaFile | null;
  lastChunk: NormalizedAudioChunk | null;
  chunksProduced: number;
  volume: number;
  error: string | null;
}
