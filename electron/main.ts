import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";

const isDev = process.argv.includes("--dev");

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    title: "Simultaneous Interpretation",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void window.loadURL("http://127.0.0.1:5173");
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(path.join(__dirname, "../dist/index.html"));
}

ipcMain.handle("dialog:select-local-media-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择用于模拟实时输入的音频或视频文件",
    properties: ["openFile"],
    filters: [
      {
        name: "Media files",
        extensions: ["mp3", "wav", "m4a", "aac", "flac", "mp4", "mov", "mkv", "webm"]
      },
      { name: "All files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileStat = await stat(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    size: fileStat.size,
    extension: path.extname(filePath).replace(".", "").toLowerCase()
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
