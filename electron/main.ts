import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, session } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";

const isDev = process.argv.includes("--dev");
let floatingCaptionWindow: BrowserWindow | null = null;
let latestFloatingCaptionState: FloatingCaptionState | null = null;

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

const defaultFloatingOptions: FloatingCaptionOptions = {
  layout: "standard",
  position: "bottom-right"
};

function getFloatingWindowSize(layout: FloatingCaptionLayout): { width: number; height: number } {
  if (layout === "compact") {
    return { width: 460, height: 176 };
  }

  if (layout === "wide") {
    return { width: 760, height: 220 };
  }

  return { width: 620, height: 200 };
}

function getFloatingWindowBounds(options: FloatingCaptionOptions): Electron.Rectangle {
  const workArea = screen.getPrimaryDisplay().workArea;
  const size = getFloatingWindowSize(options.layout);
  const margin = 28;
  const isRight = options.position.endsWith("right");
  const isBottom = options.position.startsWith("bottom");

  return {
    ...size,
    x: isRight ? workArea.x + workArea.width - size.width - margin : workArea.x + margin,
    y: isBottom ? workArea.y + workArea.height - size.height - margin : workArea.y + margin
  };
}

function loadFloatingCaptionWindow(window: BrowserWindow): void {
  if (isDev) {
    void window.loadURL("http://127.0.0.1:5173?window=floating");
    return;
  }

  void window.loadFile(path.join(__dirname, "../dist/index.html"), {
    query: { window: "floating" }
  });
}

function sendFloatingCaptionState(): void {
  if (!floatingCaptionWindow || floatingCaptionWindow.isDestroyed() || !latestFloatingCaptionState) {
    return;
  }

  floatingCaptionWindow.webContents.send("floating-caption:update", latestFloatingCaptionState);
}

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

function createFloatingCaptionWindow(options = defaultFloatingOptions): BrowserWindow {
  if (floatingCaptionWindow && !floatingCaptionWindow.isDestroyed()) {
    floatingCaptionWindow.setBounds(getFloatingWindowBounds(options), true);
    floatingCaptionWindow.show();
    floatingCaptionWindow.focus();
    sendFloatingCaptionState();
    return floatingCaptionWindow;
  }

  floatingCaptionWindow = new BrowserWindow({
    ...getFloatingWindowBounds(options),
    minWidth: 380,
    minHeight: 140,
    title: "Floating Caption",
    frame: false,
    resizable: true,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  floatingCaptionWindow.setAlwaysOnTop(true, "screen-saver");
  floatingCaptionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingCaptionWindow.on("closed", () => {
    floatingCaptionWindow = null;
  });
  floatingCaptionWindow.webContents.on("did-finish-load", sendFloatingCaptionState);
  loadFloatingCaptionWindow(floatingCaptionWindow);

  return floatingCaptionWindow;
}

ipcMain.handle("dialog:select-local-media-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select a media file for realtime simulation",
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

ipcMain.handle("desktop:list-audio-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name
  }));
});

ipcMain.handle("floating-caption:open", (_event, options: FloatingCaptionOptions) => {
  const window = createFloatingCaptionWindow(options);
  return {
    visible: true,
    bounds: window.getBounds()
  };
});

ipcMain.handle("floating-caption:close", () => {
  if (floatingCaptionWindow && !floatingCaptionWindow.isDestroyed()) {
    floatingCaptionWindow.close();
  }

  return { visible: false };
});

ipcMain.handle("floating-caption:configure", (_event, options: FloatingCaptionOptions) => {
  const window = createFloatingCaptionWindow(options);
  window.setBounds(getFloatingWindowBounds(options), true);
  return {
    visible: true,
    bounds: window.getBounds()
  };
});

ipcMain.on("floating-caption:update", (_event, state: FloatingCaptionState) => {
  latestFloatingCaptionState = state;
  sendFloatingCaptionState();
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media" || permission === "display-capture");
  });

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
