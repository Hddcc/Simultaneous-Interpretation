import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, session } from "electron";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { detectNativeSystemAudioCapability } from "./nativeAudioCapability";
import {
  appendRealtimeProviderAudioChunk,
  getProviderHealth,
  getProviderRuntimeConfig,
  pullRealtimeProviderAsrEvents,
  startRealtimeProviderSession,
  stopRealtimeProviderSession,
  updateRealtimeProviderQueueState,
  type AppendRealtimeProviderAudioChunkRequest,
  type RealtimeProviderQueueSnapshot,
  type StartRealtimeProviderSessionRequest
} from "./providerSession";

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

interface AiRuntimeConfig {
  provider: "mock" | "openai" | "custom";
  asrMode: "mock" | "provider";
  asrModel: string;
  asrBaseUrl: string;
  translationProvider: "mock" | "openai" | "deepseek" | "custom";
  translationModel: string;
  translationBaseUrl: string;
  hasOpenAiKey: boolean;
  hasDeepSeekKey: boolean;
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
  provider: "openai" | "deepseek" | "custom";
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

interface OpenAiErrorResponse {
  error?: {
    message?: string;
  };
}

interface OpenAiResponseOutput {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
}

interface ChatCompletionOutput {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface OpenAiTranscriptionOutput {
  text?: string;
}

const defaultFloatingOptions: FloatingCaptionOptions = {
  layout: "standard",
  position: "bottom-right"
};

async function loadLocalEnv(): Promise<void> {
  const envPath = path.join(process.cwd(), ".env");

  try {
    const content = await readFile(envPath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // .env is optional. The app can still run with mock providers.
  }
}

function getAiRuntimeConfig(): AiRuntimeConfig {
  const providerRuntimeConfig = getProviderRuntimeConfig();
  const provider =
    providerRuntimeConfig.asrProvider === "openai"
      ? "openai"
      : providerRuntimeConfig.asrProvider === "custom"
        ? "custom"
        : "mock";
  const asrMode = provider !== "mock" ? "provider" : "mock";

  return {
    provider,
    asrMode,
    asrModel: providerRuntimeConfig.asrModel,
    asrBaseUrl: providerRuntimeConfig.asrBaseUrl,
    translationProvider: providerRuntimeConfig.translationProvider,
    translationModel: providerRuntimeConfig.translationModel,
    translationBaseUrl: providerRuntimeConfig.translationBaseUrl,
    hasOpenAiKey: providerRuntimeConfig.hasOpenAiKey,
    hasDeepSeekKey: providerRuntimeConfig.hasDeepSeekKey,
    realtimeEnabled: providerRuntimeConfig.realtimeEnabled,
    canStartRealtime: providerRuntimeConfig.canStartRealtime,
    missingProviderConfig: providerRuntimeConfig.missing,
    secretsInRenderer: false
  };
}

function getOpenAiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("请先在 .env 中配置 OPENAI_API_KEY。");
  }

  return apiKey;
}

function getDeepSeekKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("请先在 .env 中配置 DEEPSEEK_API_KEY。");
  }

  return apiKey;
}

function readOpenAiError(payload: OpenAiErrorResponse): string {
  return payload.error?.message || "OpenAI 请求失败。";
}

function readOpenAiOutputText(payload: OpenAiResponseOutput): string {
  if (payload.output_text) {
    return payload.output_text.trim();
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((value): value is string => Boolean(value?.trim()));

  if (!text) {
    throw new Error("OpenAI 返回结果中没有可用文本。");
  }

  return text.trim();
}

function readChatCompletionText(payload: ChatCompletionOutput): string {
  const text = payload.choices
    ?.map((choice) => choice.message?.content)
    .find((value): value is string => Boolean(value?.trim()));

  if (!text) {
    throw new Error("兼容翻译接口返回结果中没有可用文本。");
  }

  return text.trim();
}

function buildProviderEndpoint(baseUrl: string, pathSuffix: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${pathSuffix}`;
}

function buildTranslationContextText(request: TranslateTextRequest): string {
  if (!request.context || request.context.length === 0) {
    return "No previous subtitle context.";
  }

  return request.context
    .map((item, index) => `${index + 1}. ${item.sourceText} => ${item.translatedText}`)
    .join("\n");
}

function buildTranslationMessages(request: TranslateTextRequest) {
  const contextText = buildTranslationContextText(request);

  return [
    {
      role: "system",
      content:
        "You are a realtime conference interpreter. Translate faithfully, keep terminology stable, use recent context for correction, and return only the translated text."
    },
    {
      role: "user",
      content: `Translate from ${request.sourceLanguage} to ${request.targetLanguage}.\n\nRecent context:\n${contextText}\n\nText:\n${request.text}`
    }
  ];
}

function getMediaMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".mp3") {
    return "audio/mpeg";
  }

  if (extension === ".wav") {
    return "audio/wav";
  }

  if (extension === ".m4a") {
    return "audio/mp4";
  }

  if (extension === ".mp4") {
    return "video/mp4";
  }

  if (extension === ".webm") {
    return "video/webm";
  }

  return "application/octet-stream";
}

function normalizeOpenAiLanguage(languageCode: string): string {
  return languageCode.toLowerCase().startsWith("zh") ? "zh" : "en";
}

async function translateWithOpenAi(
  request: TranslateTextRequest,
  runtimeConfig = getAiRuntimeConfig()
): Promise<TranslateTextResponse> {
  const startedAtMs = Date.now();
  const model = request.model || runtimeConfig.translationModel;

  const response = await fetch(buildProviderEndpoint(runtimeConfig.translationBaseUrl, "/responses"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildTranslationMessages(request)
    })
  });

  const payload = (await response.json()) as OpenAiResponseOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw new Error(readOpenAiError(payload));
  }

  return {
    text: readOpenAiOutputText(payload),
    provider: "openai",
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

async function translateWithOpenAiCompatible(
  request: TranslateTextRequest,
  provider: "deepseek" | "custom",
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<TranslateTextResponse> {
  const startedAtMs = Date.now();
  const response = await fetch(buildProviderEndpoint(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: buildTranslationMessages(request),
      temperature: 0.2
    })
  });

  const payload = (await response.json()) as ChatCompletionOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw new Error(readOpenAiError(payload));
  }

  return {
    text: readChatCompletionText(payload),
    provider,
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

function getCustomTranslationKey(): string {
  return process.env.CUSTOM_TRANSLATION_API_KEY || process.env.OPENAI_API_KEY || "";
}

async function translateWithConfiguredProvider(
  request: TranslateTextRequest
): Promise<TranslateTextResponse> {
  const runtimeConfig = getAiRuntimeConfig();
  const model = request.model || runtimeConfig.translationModel;

  if (runtimeConfig.translationProvider === "openai") {
    return translateWithOpenAi(request, runtimeConfig);
  }

  if (runtimeConfig.translationProvider === "deepseek") {
    return translateWithOpenAiCompatible(
      request,
      "deepseek",
      getDeepSeekKey(),
      runtimeConfig.translationBaseUrl,
      model
    );
  }

  if (runtimeConfig.translationProvider === "custom") {
    const apiKey = getCustomTranslationKey();
    if (!apiKey) {
      throw new Error("请先在 .env 中配置 CUSTOM_TRANSLATION_API_KEY 或 OPENAI_API_KEY。");
    }

    return translateWithOpenAiCompatible(
      request,
      "custom",
      apiKey,
      runtimeConfig.translationBaseUrl,
      model
    );
  }

  throw new Error("当前使用本地模拟翻译。");
}

async function transcribeLocalMediaFileWithOpenAi(
  request: TranscribeLocalMediaFileRequest
): Promise<TranscribeLocalMediaFileResponse> {
  const startedAtMs = Date.now();
  const model = request.model || getAiRuntimeConfig().asrModel;
  const fileBuffer = await readFile(request.filePath);
  const form = new FormData();
  form.set("model", model);
  form.set("language", normalizeOpenAiLanguage(request.languageCode));
  form.set("response_format", "json");
  form.set(
    "file",
    new Blob([fileBuffer], { type: getMediaMimeType(request.filePath) }),
    path.basename(request.filePath)
  );

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`
    },
    body: form
  });

  const payload = (await response.json()) as OpenAiTranscriptionOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw new Error(readOpenAiError(payload));
  }

  if (!payload.text?.trim()) {
    throw new Error("OpenAI 转写结果为空。");
  }

  return {
    text: payload.text.trim(),
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

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
    title: "声桥 LinguaBridge",
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

ipcMain.handle("native-audio:get-system-capture-capability", () =>
  detectNativeSystemAudioCapability()
);

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

ipcMain.handle("ai:get-runtime-config", () => getAiRuntimeConfig());

ipcMain.handle("provider:get-health", () => getProviderHealth());

ipcMain.handle(
  "provider:start-realtime-session",
  (_event, request: StartRealtimeProviderSessionRequest) => startRealtimeProviderSession(request)
);

ipcMain.handle(
  "provider:update-queue-state",
  (_event, queue: RealtimeProviderQueueSnapshot) => updateRealtimeProviderQueueState(queue)
);

ipcMain.handle(
  "provider:append-audio-chunk",
  (_event, chunk: AppendRealtimeProviderAudioChunkRequest) =>
    appendRealtimeProviderAudioChunk(chunk)
);

ipcMain.handle("provider:pull-asr-events", () => pullRealtimeProviderAsrEvents());

ipcMain.handle("provider:stop-realtime-session", () => stopRealtimeProviderSession());

ipcMain.handle("ai:translate-text", (_event, request: TranslateTextRequest) =>
  translateWithConfiguredProvider(request)
);

ipcMain.handle("ai:transcribe-local-media-file", (_event, request: TranscribeLocalMediaFileRequest) =>
  transcribeLocalMediaFileWithOpenAi(request)
);

app.whenReady().then(async () => {
  await loadLocalEnv();

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
