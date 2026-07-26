export interface RealtimeLatencyTuning {
  audioChunkDurationMs: number;
  providerAsrPollIntervalMs: number;
  minPartialCharacters: number;
  minPartialWords: number;
  partialDebounceMs: number;
  latencyWarningMs: number;
}

export const DEFAULT_REALTIME_LATENCY_TUNING: RealtimeLatencyTuning = {
  audioChunkDurationMs: 160,
  providerAsrPollIntervalMs: 750,
  minPartialCharacters: 10,
  minPartialWords: 3,
  partialDebounceMs: 120,
  latencyWarningMs: 1500
};

function readNumber(name: string, fallback: number): number {
  const value = Number(import.meta.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadRealtimeLatencyTuning(): RealtimeLatencyTuning {
  return {
    audioChunkDurationMs: readNumber(
      "VITE_AUDIO_CHUNK_DURATION_MS",
      DEFAULT_REALTIME_LATENCY_TUNING.audioChunkDurationMs
    ),
    providerAsrPollIntervalMs: readNumber(
      "VITE_PROVIDER_ASR_POLL_INTERVAL_MS",
      DEFAULT_REALTIME_LATENCY_TUNING.providerAsrPollIntervalMs
    ),
    minPartialCharacters: readNumber(
      "VITE_TRANSLATION_MIN_PARTIAL_CHARACTERS",
      DEFAULT_REALTIME_LATENCY_TUNING.minPartialCharacters
    ),
    minPartialWords: readNumber(
      "VITE_TRANSLATION_MIN_PARTIAL_WORDS",
      DEFAULT_REALTIME_LATENCY_TUNING.minPartialWords
    ),
    partialDebounceMs: readNumber(
      "VITE_TRANSLATION_PARTIAL_DEBOUNCE_MS",
      DEFAULT_REALTIME_LATENCY_TUNING.partialDebounceMs
    ),
    latencyWarningMs: readNumber(
      "VITE_VISIBLE_LATENCY_WARNING_MS",
      DEFAULT_REALTIME_LATENCY_TUNING.latencyWarningMs
    )
  };
}
