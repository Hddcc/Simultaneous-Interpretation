import type { AudioPayload, AudioPayloadMetadata, AudioSourceType, LocalMediaFile, NormalizedAudioChunk } from "./types";

export const SIMULATED_CHUNK_DURATION_MS = 500;
export const SIMULATED_SAMPLE_RATE = 16000;
export const SIMULATED_CHANNELS = 1;

const emptyPayloadMetadata: AudioPayloadMetadata = {
  available: false,
  providerReady: false,
  encoding: "none",
  sampleFormat: "u8-time-domain",
  byteLength: 0,
  frameCount: 0,
  producedAtMs: 0
};

export function createEmptyPayloadMetadata(): AudioPayloadMetadata {
  return {
    ...emptyPayloadMetadata,
    producedAtMs: Date.now()
  };
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function createPcm16PayloadFromTimeDomainSamples(
  samples: Uint8Array,
  sampleRate = SIMULATED_SAMPLE_RATE,
  channels = SIMULATED_CHANNELS,
  durationMs = SIMULATED_CHUNK_DURATION_MS
): AudioPayload {
  const pcmBytes = new Uint8Array(samples.length * 2);
  const view = new DataView(pcmBytes.buffer);

  samples.forEach((sample, index) => {
    const centered = Math.max(-1, Math.min(1, (sample - 128) / 128));
    view.setInt16(index * 2, Math.round(centered * 32767), true);
  });

  return {
    encoding: "pcm16-base64",
    sampleFormat: "s16le",
    sampleRate,
    channels,
    frameCount: samples.length,
    byteLength: pcmBytes.byteLength,
    durationMs,
    data: encodeBytesToBase64(pcmBytes)
  };
}

export function createPcm16PayloadFromFloatSamples(
  samples: Float32Array,
  sampleRate = SIMULATED_SAMPLE_RATE,
  channels = SIMULATED_CHANNELS,
  durationMs = SIMULATED_CHUNK_DURATION_MS
): AudioPayload {
  const pcmBytes = new Uint8Array(samples.length * 2);
  const view = new DataView(pcmBytes.buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * 2, Math.round(clamped * 32767), true);
  });

  return {
    encoding: "pcm16-base64",
    sampleFormat: "s16le",
    sampleRate,
    channels,
    frameCount: samples.length,
    byteLength: pcmBytes.byteLength,
    durationMs,
    data: encodeBytesToBase64(pcmBytes)
  };
}

function createPayloadMetadata(payload?: AudioPayload): AudioPayloadMetadata {
  if (!payload) {
    return createEmptyPayloadMetadata();
  }

  return {
    available: true,
    providerReady: payload.encoding === "pcm16-base64",
    encoding: payload.encoding,
    sampleFormat: payload.sampleFormat,
    byteLength: payload.byteLength,
    frameCount: payload.frameCount,
    producedAtMs: Date.now()
  };
}

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
    fileName: file?.name,
    payloadMetadata: createPayloadMetadata()
  };
}

export function createCapturedMicrophoneChunk(
  sequence: number,
  volume: number,
  deviceLabel: string,
  payload?: AudioPayload
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
    deviceLabel,
    payload,
    payloadMetadata: createPayloadMetadata(payload)
  };
}

export function createCapturedSystemAudioChunk(
  sequence: number,
  volume: number,
  sourceName: string,
  payload?: AudioPayload
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
    deviceLabel: sourceName,
    payload,
    payloadMetadata: createPayloadMetadata(payload)
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
