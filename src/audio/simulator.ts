import type { AudioSourceType, LocalMediaFile, NormalizedAudioChunk } from "./types";

export const SIMULATED_CHUNK_DURATION_MS = 500;
export const SIMULATED_SAMPLE_RATE = 16000;
export const SIMULATED_CHANNELS = 1;

export function createSimulatedChunk(
  sourceType: AudioSourceType,
  sequence: number,
  file?: LocalMediaFile | null
): NormalizedAudioChunk {
  const timestampMs = sequence * SIMULATED_CHUNK_DURATION_MS;
  const volume = Math.round((0.35 + Math.abs(Math.sin(sequence * 0.72)) * 0.55) * 100) / 100;

  return {
    id: `${sourceType}-${sequence}-${timestampMs}`,
    sourceType,
    sequence,
    timestampMs,
    durationMs: SIMULATED_CHUNK_DURATION_MS,
    sampleRate: SIMULATED_SAMPLE_RATE,
    channels: SIMULATED_CHANNELS,
    volume,
    status: "simulated",
    fileName: file?.name
  };
}

export function createCapturedMicrophoneChunk(
  sequence: number,
  volume: number,
  deviceLabel: string
): NormalizedAudioChunk {
  const timestampMs = sequence * SIMULATED_CHUNK_DURATION_MS;

  return {
    id: `microphone-${sequence}-${timestampMs}`,
    sourceType: "microphone",
    sequence,
    timestampMs,
    durationMs: SIMULATED_CHUNK_DURATION_MS,
    sampleRate: SIMULATED_SAMPLE_RATE,
    channels: SIMULATED_CHANNELS,
    volume,
    status: "captured",
    deviceLabel
  };
}

export function createCapturedSystemAudioChunk(
  sequence: number,
  volume: number,
  sourceName: string
): NormalizedAudioChunk {
  const timestampMs = sequence * SIMULATED_CHUNK_DURATION_MS;

  return {
    id: `system-${sequence}-${timestampMs}`,
    sourceType: "system",
    sequence,
    timestampMs,
    durationMs: SIMULATED_CHUNK_DURATION_MS,
    sampleRate: SIMULATED_SAMPLE_RATE,
    channels: SIMULATED_CHANNELS,
    volume,
    status: "captured",
    deviceLabel: sourceName
  };
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  const milliseconds = (ms % 1000).toString().padStart(3, "0");

  return `${minutes}:${seconds}.${milliseconds}`;
}
