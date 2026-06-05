import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("simultaneousInterpretation", {
  appName: "Simultaneous Interpretation",
  version: "0.1.0"
});
