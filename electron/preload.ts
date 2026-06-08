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
  statusLabel: string;
  compactStatusLabel: string;
  severity: "neutral" | "active" | "warning" | "error";
  languageDirection: string;
  sessionStatus: string;
  latencyLabel: string;
  revised: boolean;
  updatedAtMs: number;
}

interface AiRuntimeConfig {
  provider: "mock" | "openai" | "aliyun" | "custom";
  asrMode: "mock" | "provider";
  asrModel: string;
  asrBaseUrl: string;
  translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
  translationModel: string;
  translationBaseUrl: string;
  hasOpenAiKey: boolean;
  hasDeepSeekKey: boolean;
  hasDashScopeKey: boolean;
  realtimeEnabled: boolean;
  canStartRealtime: boolean;
  missingProviderConfig: string[];
  secretsInRenderer: false;
}

interface TranslateTextRequest {
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
  translationBaseUrl: string;
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
  latencyMs: number;
  provider: "mock" | "openai" | "aliyun" | "custom";
  model: string;
}

interface AppendRealtimeProviderAudioChunkResponse {
  health: ProviderHealth;
  events: RealtimeProviderAsrEvent[];
}

contextBridge.exposeInMainWorld("simultaneousInterpretation", {
  appName: "声桥 LinguaBridge",
  version: "0.1.0",
  selectLocalMediaFile: () => ipcRenderer.invoke("dialog:select-local-media-file"),
  listDesktopAudioSources: () => ipcRenderer.invoke("desktop:list-audio-sources"),
  getSystemAudioCaptureCapability: () =>
    ipcRenderer.invoke("native-audio:get-system-capture-capability"),
  openFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:open", options),
  closeFloatingCaption: () => ipcRenderer.invoke("floating-caption:close"),
  configureFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:configure", options),
  getAiRuntimeConfig: () => ipcRenderer.invoke("ai:get-runtime-config"),
  getProviderHealth: () => ipcRenderer.invoke("provider:get-health"),
  startRealtimeProviderSession: (request: StartRealtimeProviderSessionRequest) =>
    ipcRenderer.invoke("provider:start-realtime-session", request),
  updateRealtimeProviderQueueState: (queue: RealtimeProviderQueueSnapshot) =>
    ipcRenderer.invoke("provider:update-queue-state", queue),
  appendRealtimeProviderAudioChunk: (chunk: AppendRealtimeProviderAudioChunkRequest) =>
    ipcRenderer.invoke("provider:append-audio-chunk", chunk),
  pullRealtimeProviderAsrEvents: () => ipcRenderer.invoke("provider:pull-asr-events"),
  stopRealtimeProviderSession: () => ipcRenderer.invoke("provider:stop-realtime-session"),
  translateText: (request: TranslateTextRequest) => ipcRenderer.invoke("ai:translate-text", request),
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
