export {};

declare global {
  interface LocalMediaFile {
    path: string;
    name: string;
    size: number;
    extension: string;
  }

  interface DesktopAudioSource {
    id: string;
    name: string;
  }

  type FloatingCaptionLayout = "compact" | "standard" | "wide";
  type FloatingCaptionPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

  interface FloatingCaptionOptions {
    layout: FloatingCaptionLayout;
    position: FloatingCaptionPosition;
  }

  interface FloatingCaptionState {
    translatedText: string;
    sourceText: string;
    previousText: string | null;
    statusLabel: string;
    compactStatusLabel: string;
    severity: "neutral" | "active" | "warning" | "error";
    languageDirection: string;
    sessionStatus: string;
    latencyLabel: string;
    revised: boolean;
    locked: boolean;
    mousePassthrough: boolean;
    opacity: number;
    fontScale: number;
    controlsVisible: boolean;
    updatedAtMs: number;
  }

  interface FloatingCaptionWindowResult {
    visible: boolean;
    bounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  interface AiRuntimeConfig {
    provider: "mock" | "openai" | "aliyun" | "custom";
    asrMode: "mock" | "provider";
    asrModel: string;
    asrBaseUrl: string;
    translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
    translationModel: string;
    fastDraftModel: string;
    fastDraftStreaming: boolean;
    translationBaseUrl: string;
    refinementProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
    refinementModel: string;
    refinementBaseUrl: string;
    hasOpenAiKey: boolean;
    hasDeepSeekKey: boolean;
    hasDashScopeKey: boolean;
    realtimeEnabled: boolean;
    canStartRealtime: boolean;
    missingProviderConfig: string[];
    secretsInRenderer: false;
  }

  interface TranslateTextRequest {
    requestId?: string;
    stream?: boolean;
    fastDraft?: boolean;
    minimumReadableCharacters?: number;
    text: string;
    sourceLanguage: string;
    targetLanguage: string;
    model?: string;
    context?: Array<{
      sourceText: string;
      translatedText: string;
    }>;
  }

  interface TranslateTextResponse {
    text: string;
    provider: "openai" | "deepseek" | "aliyun" | "custom";
    model: string;
    latencyMs: number;
  }

  interface TranslationDraftResponse extends TranslateTextResponse {
    requestId: string;
    receivedAtMs: number;
    complete: boolean;
  }

  interface RefineSubtitleRequest {
    sourceText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    model?: string;
    context?: Array<{
      sourceText: string;
      translatedText: string;
    }>;
    terminologyHints?: string[];
  }

  interface RefineSubtitleResponse {
    refinedSourceText: string;
    refinedTranslatedText: string;
    reason: string;
    provider: "openai" | "deepseek" | "aliyun" | "custom";
    model: string;
    latencyMs: number;
  }

  interface TranscribeLocalMediaFileRequest {
    filePath: string;
    languageCode: string;
    model?: string;
  }

  interface TranscribeLocalMediaFileResponse {
    text: string;
    model: string;
    latencyMs: number;
  }

  interface NativeSystemAudioCapability {
    platform: string;
    strategy: "windows-wasapi-loopback-helper";
    helperName: string;
    helperPath: string;
    available: boolean;
    status: "available" | "unsupported-platform" | "helper-missing";
    sampleRate: number;
    channels: number;
    chunkDurationMs: number;
    fallback: "electron-desktop-capture";
    checkedAtMs: number;
    notes: string[];
    nextStep: string;
  }

  type ProviderConnectionState =
    | "idle"
    | "ready"
    | "missing-config"
    | "connecting"
    | "streaming"
    | "reconnecting"
    | "degraded"
    | "closing"
    | "closed"
    | "error";

  interface RealtimeProviderQueueSnapshot {
    depth: number;
    maxDepth: number;
    dropped: number;
    lastSequence: number | null;
    lastPayloadBytes: number;
  }

  interface ProviderRuntimeConfig {
    asrProvider: "mock" | "openai" | "aliyun" | "custom";
    asrModel: string;
    asrBaseUrl: string;
    translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
    translationModel: string;
    fastDraftModel: string;
    fastDraftStreaming: boolean;
    translationBaseUrl: string;
    refinementProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
    refinementModel: string;
    refinementBaseUrl: string;
    hasOpenAiKey: boolean;
    hasDeepSeekKey: boolean;
    hasDashScopeKey: boolean;
    realtimeEnabled: boolean;
    canStartRealtime: boolean;
    missing: string[];
    secretsInRenderer: false;
    loadedAtMs: number;
  }

  interface RealtimeProviderSessionState {
    state: ProviderConnectionState;
    sessionId: string | null;
    sourceType: "system" | "microphone" | null;
    languagePairId: string | null;
    asrProvider: "mock" | "openai" | "aliyun" | "custom";
    translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
    queue: RealtimeProviderQueueSnapshot;
    timing: {
      correlatedEvents: number;
      uncorrelatedEvents: number;
    };
    recentLatencyMs: number | null;
    error: string | null;
    startedAtMs: number | null;
    updatedAtMs: number;
  }

  interface ProviderHealth {
    config: ProviderRuntimeConfig;
    session: RealtimeProviderSessionState;
  }

  interface StartRealtimeProviderSessionRequest {
    sourceType: "system" | "microphone";
    languagePairId: string;
    sourceLanguageCode?: string;
    queue: RealtimeProviderQueueSnapshot;
  }

  interface RealtimeProviderAudioPayload {
    encoding: "pcm16-base64";
    sampleFormat: "s16le";
    sampleRate: number;
    channels: number;
    frameCount: number;
    byteLength: number;
    durationMs: number;
    data: string;
  }

  interface AppendRealtimeProviderAudioChunkRequest {
    id: string;
    sourceType: "system" | "microphone";
    sequence: number;
    timestampMs: number;
    capturedAtMs?: number;
    durationMs: number;
    volume: number;
    queue: RealtimeProviderQueueSnapshot;
    payload: RealtimeProviderAudioPayload;
  }

  interface RealtimeProviderAsrEvent {
    id: string;
    segmentId: string;
    chunkId: string;
    sourceType: "system" | "microphone";
    sequence: number;
    audioStartMs: number;
    audioEndMs: number;
    text: string;
    status: "partial" | "final";
    revision: number;
    receivedAtMs: number;
    audioEvidenceEndAtMs: number | null;
    asrReceivedAtMs: number;
    timingCorrelation: "provider-offset" | "segment-revision" | "missing";
    latencyMs: number;
    provider: "mock" | "openai" | "aliyun" | "custom";
    model: string;
  }

  interface AppendRealtimeProviderAudioChunkResponse {
    health: ProviderHealth;
    events: RealtimeProviderAsrEvent[];
  }

  interface Window {
    simultaneousInterpretation?: {
      appName: string;
      version: string;
      selectLocalMediaFile: () => Promise<LocalMediaFile | null>;
      exportSubtitleHistory: (content: string, suggestedName: string) => Promise<boolean>;
      listDesktopAudioSources: () => Promise<DesktopAudioSource[]>;
      getSystemAudioCaptureCapability: () => Promise<NativeSystemAudioCapability>;
      openFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      closeFloatingCaption: () => Promise<FloatingCaptionWindowResult>;
      configureFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      setFloatingCaptionInteraction: (
        options: {
          locked: boolean;
          mousePassthrough: boolean;
        }
      ) => Promise<FloatingCaptionWindowResult>;
      resetFloatingCaption: () => Promise<FloatingCaptionWindowResult>;
      getAiRuntimeConfig: () => Promise<AiRuntimeConfig>;
      getProviderHealth: () => Promise<ProviderHealth>;
      startRealtimeProviderSession: (
        request: StartRealtimeProviderSessionRequest
      ) => Promise<ProviderHealth>;
      updateRealtimeProviderQueueState: (
        queue: RealtimeProviderQueueSnapshot
      ) => Promise<ProviderHealth>;
      appendRealtimeProviderAudioChunk: (
        chunk: AppendRealtimeProviderAudioChunkRequest
      ) => Promise<AppendRealtimeProviderAudioChunkResponse>;
      pullRealtimeProviderAsrEvents: () => Promise<RealtimeProviderAsrEvent[]>;
      onRealtimeProviderAsrEvent: (
        callback: (event: RealtimeProviderAsrEvent) => void
      ) => () => void;
      stopRealtimeProviderSession: () => Promise<ProviderHealth>;
      translateText: (request: TranslateTextRequest) => Promise<TranslateTextResponse>;
      cancelTranslation: (requestId: string) => void;
      onTranslationDraft: (
        callback: (event: TranslationDraftResponse) => void
      ) => () => void;
      transcribeLocalMediaFile: (
        request: TranscribeLocalMediaFileRequest
      ) => Promise<TranscribeLocalMediaFileResponse>;
      updateFloatingCaption: (state: FloatingCaptionState) => void;
      refineSubtitle: (request: RefineSubtitleRequest) => Promise<RefineSubtitleResponse>;
      onFloatingCaptionUpdate: (callback: (state: FloatingCaptionState) => void) => () => void;
    };
  }
}
