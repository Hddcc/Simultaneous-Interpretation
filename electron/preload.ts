import { contextBridge, ipcRenderer } from "electron";

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
  ok?: true;
  text: string;
  provider: "openai" | "deepseek" | "aliyun" | "custom";
  model: string;
  latencyMs: number;
}

interface TranslateTextFailureResponse {
  ok: false;
  text: "";
  provider: "openai" | "deepseek" | "aliyun" | "custom";
  model: string;
  latencyMs: number;
  failure: {
    category: "provider" | "network" | "invalid-response" | "untranslated-output" | "cancelled";
    message: string;
    httpStatus: number | null;
    providerCode: string | null;
  };
}

type TranslateTextResult = TranslateTextResponse | TranslateTextFailureResponse;

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

contextBridge.exposeInMainWorld("simultaneousInterpretation", {
  appName: "同声传译",
  version: "0.1.0",
  selectLocalMediaFile: () => ipcRenderer.invoke("dialog:select-local-media-file"),
  exportSubtitleHistory: (content: string, suggestedName: string) =>
    ipcRenderer.invoke("dialog:export-subtitle-history", content, suggestedName),
  listDesktopAudioSources: () => ipcRenderer.invoke("desktop:list-audio-sources"),
  getSystemAudioCaptureCapability: () =>
    ipcRenderer.invoke("native-audio:get-system-capture-capability"),
  openFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:open", options),
  closeFloatingCaption: () => ipcRenderer.invoke("floating-caption:close"),
  configureFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:configure", options),
  setFloatingCaptionInteraction: (options: { locked: boolean; mousePassthrough: boolean }) =>
    ipcRenderer.invoke("floating-caption:set-interaction", options),
  resetFloatingCaption: () => ipcRenderer.invoke("floating-caption:reset"),
  getAiRuntimeConfig: () => ipcRenderer.invoke("ai:get-runtime-config"),
  getProviderHealth: () => ipcRenderer.invoke("provider:get-health"),
  startRealtimeProviderSession: (request: StartRealtimeProviderSessionRequest) =>
    ipcRenderer.invoke("provider:start-realtime-session", request),
  updateRealtimeProviderQueueState: (queue: RealtimeProviderQueueSnapshot) =>
    ipcRenderer.invoke("provider:update-queue-state", queue),
  appendRealtimeProviderAudioChunk: (chunk: AppendRealtimeProviderAudioChunkRequest) =>
    ipcRenderer.invoke("provider:append-audio-chunk", chunk),
  pullRealtimeProviderAsrEvents: () => ipcRenderer.invoke("provider:pull-asr-events"),
  onRealtimeProviderAsrEvent: (callback: (event: RealtimeProviderAsrEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: RealtimeProviderAsrEvent) => {
      callback(event);
    };
    ipcRenderer.on("provider:asr-event", listener);
    return () => ipcRenderer.removeListener("provider:asr-event", listener);
  },
  stopRealtimeProviderSession: () => ipcRenderer.invoke("provider:stop-realtime-session"),
  translateText: (request: TranslateTextRequest) => ipcRenderer.invoke("ai:translate-text", request),
  cancelTranslation: (requestId: string) => ipcRenderer.send("ai:cancel-translation", requestId),
  onTranslationDraft: (callback: (event: TranslationDraftResponse) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: TranslationDraftResponse) => {
      callback(event);
    };
    ipcRenderer.on("ai:translation-draft", listener);
    return () => ipcRenderer.removeListener("ai:translation-draft", listener);
  },
  refineSubtitle: (request: RefineSubtitleRequest) =>
    ipcRenderer.invoke("ai:refine-subtitle", request),
  transcribeLocalMediaFile: (request: TranscribeLocalMediaFileRequest) =>
    ipcRenderer.invoke("ai:transcribe-local-media-file", request),
  updateFloatingCaption: (state: FloatingCaptionState) =>
    ipcRenderer.send("floating-caption:update", state),
  onFloatingCaptionUpdate: (callback: (state: FloatingCaptionState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: FloatingCaptionState) => {
      callback(state);
    };

    ipcRenderer.on("floating-caption:update", listener);
    return () => ipcRenderer.removeListener("floating-caption:update", listener);
  }
});
