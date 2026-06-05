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

  interface Window {
    simultaneousInterpretation?: {
      appName: string;
      version: string;
      selectLocalMediaFile: () => Promise<LocalMediaFile | null>;
      listDesktopAudioSources: () => Promise<DesktopAudioSource[]>;
      openFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      closeFloatingCaption: () => Promise<FloatingCaptionWindowResult>;
      configureFloatingCaption: (
        options: FloatingCaptionOptions
      ) => Promise<FloatingCaptionWindowResult>;
      updateFloatingCaption: (state: FloatingCaptionState) => void;
      onFloatingCaptionUpdate: (callback: (state: FloatingCaptionState) => void) => () => void;
    };
  }
}
