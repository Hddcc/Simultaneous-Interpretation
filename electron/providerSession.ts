type RealtimeAsrProvider = "mock" | "openai" | "custom";
type TranslationProvider = "mock" | "openai" | "deepseek" | "custom";
type ProviderConnectionState =
  | "idle"
  | "ready"
  | "missing-config"
  | "connecting"
  | "streaming"
  | "degraded"
  | "closing"
  | "closed"
  | "error";

export interface ProviderRuntimeConfig {
  asrProvider: RealtimeAsrProvider;
  asrModel: string;
  asrBaseUrl: string;
  translationProvider: TranslationProvider;
  translationModel: string;
  translationBaseUrl: string;
  hasOpenAiKey: boolean;
  hasDeepSeekKey: boolean;
  realtimeEnabled: boolean;
  canStartRealtime: boolean;
  missing: string[];
  secretsInRenderer: false;
  loadedAtMs: number;
}

export interface RealtimeProviderQueueSnapshot {
  depth: number;
  maxDepth: number;
  dropped: number;
  lastSequence: number | null;
  lastPayloadBytes: number;
}

export interface RealtimeProviderSessionState {
  state: ProviderConnectionState;
  sessionId: string | null;
  sourceType: "system" | "microphone" | null;
  languagePairId: string | null;
  asrProvider: RealtimeAsrProvider;
  translationProvider: TranslationProvider;
  queue: RealtimeProviderQueueSnapshot;
  recentLatencyMs: number | null;
  error: string | null;
  startedAtMs: number | null;
  updatedAtMs: number;
}

export interface ProviderHealth {
  config: ProviderRuntimeConfig;
  session: RealtimeProviderSessionState;
}

export interface StartRealtimeProviderSessionRequest {
  sourceType: "system" | "microphone";
  languagePairId: string;
  queue: RealtimeProviderQueueSnapshot;
}

const defaultQueue: RealtimeProviderQueueSnapshot = {
  depth: 0,
  maxDepth: 12,
  dropped: 0,
  lastSequence: null,
  lastPayloadBytes: 0
};

let sessionState: RealtimeProviderSessionState = createIdleSessionState();

function createIdleSessionState(): RealtimeProviderSessionState {
  const config = getProviderRuntimeConfig();

  return {
    state: config.realtimeEnabled ? "ready" : "idle",
    sessionId: null,
    sourceType: null,
    languagePairId: null,
    asrProvider: config.asrProvider,
    translationProvider: config.translationProvider,
    queue: defaultQueue,
    recentLatencyMs: null,
    error: null,
    startedAtMs: null,
    updatedAtMs: Date.now()
  };
}

function readEnv(name: string, fallback = ""): string {
  return (process.env[name] || fallback).trim();
}

function normalizeAsrProvider(value: string): RealtimeAsrProvider {
  if (value === "openai" || value === "custom") {
    return value;
  }

  return "mock";
}

function normalizeTranslationProvider(value: string): TranslationProvider {
  if (value === "openai" || value === "deepseek" || value === "custom") {
    return value;
  }

  return "mock";
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const asrProvider = normalizeAsrProvider(
    readEnv("REALTIME_ASR_PROVIDER", readEnv("VITE_AI_PROVIDER", "mock"))
  );
  const translationProvider = normalizeTranslationProvider(
    readEnv("TRANSLATION_PROVIDER", readEnv("VITE_AI_PROVIDER", "mock"))
  );
  const hasOpenAiKey = Boolean(readEnv("OPENAI_API_KEY"));
  const hasDeepSeekKey = Boolean(readEnv("DEEPSEEK_API_KEY"));
  const missing: string[] = [];

  if (asrProvider === "openai" && !hasOpenAiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (translationProvider === "openai" && !hasOpenAiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (translationProvider === "deepseek" && !hasDeepSeekKey) {
    missing.push("DEEPSEEK_API_KEY");
  }

  const realtimeEnabled = asrProvider !== "mock";

  return {
    asrProvider,
    asrModel:
      readEnv("REALTIME_ASR_MODEL") ||
      readEnv("VITE_ASR_MODEL") ||
      (asrProvider === "openai" ? "gpt-4o-mini-transcribe" : "mock-streaming-asr"),
    asrBaseUrl: readEnv("REALTIME_ASR_BASE_URL", "https://api.openai.com/v1"),
    translationProvider,
    translationModel:
      readEnv("TRANSLATION_MODEL") ||
      readEnv("VITE_TRANSLATION_MODEL") ||
      (translationProvider === "openai"
        ? "gpt-4.1-mini"
        : translationProvider === "deepseek"
          ? "deepseek-chat"
          : "mock-bilingual-translator"),
    translationBaseUrl:
      readEnv("TRANSLATION_BASE_URL") ||
      (translationProvider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1"),
    hasOpenAiKey,
    hasDeepSeekKey,
    realtimeEnabled,
    canStartRealtime: !realtimeEnabled || missing.length === 0,
    missing: Array.from(new Set(missing)),
    secretsInRenderer: false,
    loadedAtMs: Date.now()
  };
}

export function getProviderHealth(): ProviderHealth {
  const config = getProviderRuntimeConfig();

  if (
    sessionState.sessionId === null &&
    (sessionState.state === "idle" || sessionState.state === "ready")
  ) {
    sessionState = {
      ...sessionState,
      state: config.realtimeEnabled ? "ready" : "idle",
      asrProvider: config.asrProvider,
      translationProvider: config.translationProvider,
      updatedAtMs: Date.now()
    };
  }

  return {
    config,
    session: sessionState
  };
}

export function startRealtimeProviderSession(
  request: StartRealtimeProviderSessionRequest
): ProviderHealth {
  const config = getProviderRuntimeConfig();
  const now = Date.now();

  if (!config.realtimeEnabled) {
    sessionState = {
      ...createIdleSessionState(),
      queue: request.queue,
      updatedAtMs: now
    };
    return getProviderHealth();
  }

  if (!config.canStartRealtime) {
    sessionState = {
      state: "missing-config",
      sessionId: null,
      sourceType: request.sourceType,
      languagePairId: request.languagePairId,
      asrProvider: config.asrProvider,
      translationProvider: config.translationProvider,
      queue: request.queue,
      recentLatencyMs: null,
      error: `缺少本地配置：${config.missing.join(", ")}`,
      startedAtMs: null,
      updatedAtMs: now
    };
    return getProviderHealth();
  }

  sessionState = {
    state: "streaming",
    sessionId: `provider-session-${now}`,
    sourceType: request.sourceType,
    languagePairId: request.languagePairId,
    asrProvider: config.asrProvider,
    translationProvider: config.translationProvider,
    queue: request.queue,
    recentLatencyMs: null,
    error: null,
    startedAtMs: now,
    updatedAtMs: now
  };

  return getProviderHealth();
}

export function updateRealtimeProviderQueueState(
  queue: RealtimeProviderQueueSnapshot
): ProviderHealth {
  const overloaded = queue.maxDepth > 0 && queue.depth / queue.maxDepth >= 0.75;

  if (sessionState.sessionId) {
    sessionState = {
      ...sessionState,
      state: overloaded ? "degraded" : "streaming",
      queue,
      recentLatencyMs: queue.depth > 0 ? queue.depth * 120 : sessionState.recentLatencyMs,
      updatedAtMs: Date.now()
    };
  }

  return getProviderHealth();
}

export function stopRealtimeProviderSession(): ProviderHealth {
  const config = getProviderRuntimeConfig();

  sessionState = {
    ...sessionState,
    state: config.realtimeEnabled ? "closed" : "idle",
    sessionId: null,
    sourceType: null,
    languagePairId: null,
    queue: defaultQueue,
    recentLatencyMs: null,
    error: null,
    updatedAtMs: Date.now()
  };

  return getProviderHealth();
}
