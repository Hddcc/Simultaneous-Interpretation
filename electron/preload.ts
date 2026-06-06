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
  languageDirection: string;
  sessionStatus: string;
  latencyLabel: string;
  revised: boolean;
  updatedAtMs: number;
}

interface AiRuntimeConfig {
  provider: "mock" | "openai" | "custom";
  asrMode: "mock" | "provider";
  asrModel: string;
  translationModel: string;
  hasOpenAiKey: boolean;
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
