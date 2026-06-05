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

contextBridge.exposeInMainWorld("simultaneousInterpretation", {
  appName: "Simultaneous Interpretation",
  version: "0.1.0",
  selectLocalMediaFile: () => ipcRenderer.invoke("dialog:select-local-media-file"),
  listDesktopAudioSources: () => ipcRenderer.invoke("desktop:list-audio-sources"),
  openFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:open", options),
  closeFloatingCaption: () => ipcRenderer.invoke("floating-caption:close"),
  configureFloatingCaption: (options: FloatingCaptionOptions) =>
    ipcRenderer.invoke("floating-caption:configure", options),
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
