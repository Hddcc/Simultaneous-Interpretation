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
    statusLabel: string;
    languageDirection: string;
    sessionStatus: string;
    latencyLabel: string;
    revised: boolean;
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

  interface Window {
    simultaneousInterpretation?: {
      appName: string;
      version: string;
      selectLocalMediaFile: () => Promise<LocalMediaFile | null>;
      listDesktopAudioSources: () => Promise<DesktopAudioSource[]>;
      getSystemAudioCaptureCapability: () => Promise<NativeSystemAudioCapability>;
      openFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      closeFloatingCaption: () => Promise<FloatingCaptionWindowResult>;
      configureFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      getAiRuntimeConfig: () => Promise<AiRuntimeConfig>;
      translateText: (request: TranslateTextRequest) => Promise<TranslateTextResponse>;
      transcribeLocalMediaFile: (
        request: TranscribeLocalMediaFileRequest
      ) => Promise<TranscribeLocalMediaFileResponse>;
      updateFloatingCaption: (state: FloatingCaptionState) => void;
      onFloatingCaptionUpdate: (callback: (state: FloatingCaptionState) => void) => () => void;
    };
  }
}
