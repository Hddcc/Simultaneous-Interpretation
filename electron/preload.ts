import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("simultaneousInterpretation", {
  appName: "Simultaneous Interpretation",
  version: "0.1.0",
  selectLocalMediaFile: () => ipcRenderer.invoke("dialog:select-local-media-file"),
  listDesktopAudioSources: () => ipcRenderer.invoke("desktop:list-audio-sources")
});
