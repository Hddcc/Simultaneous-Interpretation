import type { AiProvider, AsrConfig, AsrMode } from "./types";

const DEFAULT_ASR_MODEL = "mock-streaming-asr";

function normalizeProvider(value: string | undefined): AiProvider {
  if (value === "openai" || value === "custom") {
    return value;
  }

  return "mock";
}

function normalizeMode(value: string | undefined, provider: AiProvider): AsrMode {
  if (value === "provider" && provider !== "mock") {
    return "provider";
  }

  return "mock";
}

export function loadAsrConfig(): AsrConfig {
  const env = import.meta.env;
  const provider = normalizeProvider(env.VITE_AI_PROVIDER);
  const mode = normalizeMode(env.VITE_ASR_MODE, provider);

  return {
    provider,
    mode,
    model: env.VITE_ASR_MODEL || DEFAULT_ASR_MODEL
  };
}
