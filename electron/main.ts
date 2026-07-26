import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, screen, session } from "electron";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectNativeSystemAudioCapability } from "./nativeAudioCapability";
import {
  defaultFloatingCaptionPreferences,
  extractFloatingCaptionContent,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
  mergeFloatingCaptionState,
  normalizeFloatingCaptionPreferences,
  resolveFloatingHeight,
  resolveFloatingWidth,
  type FloatingCaptionCommand,
  type FloatingCaptionContent,
  type FloatingCaptionPreferences,
  type FloatingCaptionState
} from "./floatingWindowLayout";
import {
  buildSubtitleRefinementMessages,
  buildTranslationContextText,
  buildTranslationMessages,
  isReadableTranslationDraft,
  parseSubtitleRefinementJson
} from "./translationPrompt";
import {
  appendRealtimeProviderAudioChunk,
  getProviderHealth,
  getProviderRuntimeConfig,
  pullRealtimeProviderAsrEvents,
  startRealtimeProviderSession,
  stopRealtimeProviderSession,
  subscribeRealtimeProviderAsrEvents,
  updateRealtimeProviderQueueState,
  type AppendRealtimeProviderAudioChunkRequest,
  type RealtimeProviderQueueSnapshot,
  type StartRealtimeProviderSessionRequest
} from "./providerSession";

const isDev = process.argv.includes("--dev");
let floatingCaptionWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let latestFloatingCaptionContent: FloatingCaptionContent | null = null;
let floatingCaptionPreferences: FloatingCaptionPreferences = defaultFloatingCaptionPreferences;

type FloatingCaptionLayout = "compact" | "standard" | "wide";
type FloatingCaptionPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface FloatingCaptionOptions {
  layout: FloatingCaptionLayout;
  position: FloatingCaptionPosition;
}

interface AiRuntimeConfig {
  provider: "mock" | "openai" | "aliyun" | "custom";
  asrMode: "mock" | "provider";
  asrModel: string;
  asrBaseUrl: string;
  translationProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
  translationModel: string;
  fastDraftModel: string;
  fastDraftStreaming: boolean;
  translationBaseUrl: string;
  refinementProvider: "mock" | "openai" | "deepseek" | "aliyun" | "custom";
  refinementModel: string;
  refinementBaseUrl: string;
  hasOpenAiKey: boolean;
  hasDeepSeekKey: boolean;
  hasDashScopeKey: boolean;
  realtimeEnabled: boolean;
  canStartRealtime: boolean;
  missingProviderConfig: string[];
  secretsInRenderer: false;
}

interface TranslateTextRequest {
  requestId?: string;
  stream?: boolean;
  fastDraft?: boolean;
  minimumReadableCharacters?: number;
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
  ok?: true;
  text: string;
  provider: "openai" | "deepseek" | "aliyun" | "custom";
  model: string;
  latencyMs: number;
}

type TranslationFailureCategory =
  | "provider"
  | "network"
  | "invalid-response"
  | "untranslated-output"
  | "cancelled";

interface TranslateTextFailureResponse {
  ok: false;
  text: "";
  provider: "openai" | "deepseek" | "aliyun" | "custom";
  model: string;
  latencyMs: number;
  failure: {
    category: TranslationFailureCategory;
    message: string;
    httpStatus: number | null;
    providerCode: string | null;
  };
}

type TranslateTextResult = TranslateTextResponse | TranslateTextFailureResponse;

interface TranslationDraftResponse extends TranslateTextResponse {
  requestId: string;
  receivedAtMs: number;
  complete: boolean;
}

interface RefineSubtitleRequest {
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  model?: string;
  context?: Array<{
    sourceText: string;
    translatedText: string;
  }>;
  terminologyHints?: string[];
}

interface RefineSubtitleResponse {
  refinedSourceText: string;
  refinedTranslatedText: string;
  reason: string;
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

interface OpenAiErrorResponse {
  error?: {
    message?: string;
    code?: string;
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
    delta?: {
      content?: string;
    };
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

let latestFloatingOptions: FloatingCaptionOptions = defaultFloatingOptions;

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
      : providerRuntimeConfig.asrProvider === "aliyun"
        ? "aliyun"
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
    fastDraftModel: providerRuntimeConfig.fastDraftModel,
    fastDraftStreaming: providerRuntimeConfig.fastDraftStreaming,
    translationBaseUrl: providerRuntimeConfig.translationBaseUrl,
    refinementProvider: providerRuntimeConfig.refinementProvider,
    refinementModel: providerRuntimeConfig.refinementModel,
    refinementBaseUrl: providerRuntimeConfig.refinementBaseUrl,
    hasOpenAiKey: providerRuntimeConfig.hasOpenAiKey,
    hasDeepSeekKey: providerRuntimeConfig.hasDeepSeekKey,
    hasDashScopeKey: providerRuntimeConfig.hasDashScopeKey,
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

function getDashScopeKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error("请先在 .env 中配置 DASHSCOPE_API_KEY。");
  }

  return apiKey;
}

function readOpenAiError(payload: OpenAiErrorResponse): string {
  return payload.error?.message || "OpenAI 请求失败。";
}

class TranslationProviderError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null,
    readonly providerCode: string | null,
    readonly category: TranslationFailureCategory = "provider"
  ) {
    super(message);
    this.name = "TranslationProviderError";
  }
}

function createProviderRequestError(
  response: Response,
  payload: OpenAiErrorResponse
): TranslationProviderError {
  return new TranslationProviderError(
    readOpenAiError(payload),
    response.status,
    payload.error?.code ?? null
  );
}

function sanitizeTranslationErrorMessage(message: string): string {
  return message
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bAuthorization\s*[:=]\s*\S+/gi, "Authorization: [redacted]");
}

function createTranslationFailureResponse(
  request: TranslateTextRequest,
  error: unknown,
  startedAtMs: number,
  cancelled: boolean
): TranslateTextFailureResponse {
  const runtimeConfig = getAiRuntimeConfig();
  const provider =
    runtimeConfig.translationProvider === "mock"
      ? "custom"
      : runtimeConfig.translationProvider;
  const typed = error instanceof TranslationProviderError ? error : null;
  const category: TranslationFailureCategory = cancelled
    ? "cancelled"
    : typed?.category ?? (error instanceof SyntaxError ? "invalid-response" : "network");
  const rawMessage =
    error instanceof Error ? error.message : cancelled ? "translation request aborted" : "翻译服务调用失败。";

  return {
    ok: false,
    text: "",
    provider,
    model: request.model || runtimeConfig.translationModel,
    latencyMs: Date.now() - startedAtMs,
    failure: {
      category,
      message: sanitizeTranslationErrorMessage(rawMessage),
      httpStatus: typed?.httpStatus ?? null,
      providerCode: typed?.providerCode ?? null
    }
  };
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
  runtimeConfig = getAiRuntimeConfig(),
  signal?: AbortSignal
): Promise<TranslateTextResponse> {
  const startedAtMs = Date.now();
  const model = request.model || runtimeConfig.translationModel;

  const response = await fetch(buildProviderEndpoint(runtimeConfig.translationBaseUrl, "/responses"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json"
    },
    signal,
    body: JSON.stringify({
      model,
      input: buildTranslationMessages(request)
    })
  });

  const payload = (await response.json()) as OpenAiResponseOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw createProviderRequestError(response, payload);
  }

  return {
    text: readOpenAiOutputText(payload),
    provider: "openai",
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

async function readCompatibleTranslationStream(
  response: Response,
  request: TranslateTextRequest,
  provider: "deepseek" | "aliyun" | "custom",
  model: string,
  startedAtMs: number,
  onDraft?: (draft: TranslationDraftResponse) => void
): Promise<TranslateTextResponse> {
  if (!response.body) {
    throw new Error("翻译服务未返回可读流。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let translatedText = "";
  let lastPublishedText = "";
  const minimumCharacters = request.minimumReadableCharacters ?? 6;

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(trimmed.slice(5).trim()) as ChatCompletionOutput;
      translatedText += payload.choices?.[0]?.delta?.content ?? "";
      if (
        translatedText !== lastPublishedText &&
        isReadableTranslationDraft(translatedText, minimumCharacters)
      ) {
        lastPublishedText = translatedText;
        onDraft?.({
          requestId: request.requestId ?? "",
          text: translatedText,
          provider,
          model,
          latencyMs: Date.now() - startedAtMs,
          receivedAtMs: Date.now(),
          complete: false
        });
      }
    } catch {
      // Ignore provider keepalive or malformed non-content chunks.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(consumeLine);
    if (done) {
      break;
    }
  }
  if (buffer) {
    consumeLine(buffer);
  }
  if (!translatedText.trim()) {
    throw new Error("流式翻译结果为空。");
  }

  return {
    text: translatedText.trim(),
    provider,
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

async function translateWithOpenAiCompatible(
  request: TranslateTextRequest,
  provider: "deepseek" | "aliyun" | "custom",
  apiKey: string,
  baseUrl: string,
  model: string,
  signal?: AbortSignal,
  onDraft?: (draft: TranslationDraftResponse) => void
): Promise<TranslateTextResponse> {
  const startedAtMs = Date.now();
  const response = await fetch(buildProviderEndpoint(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal,
    body: JSON.stringify({
      model,
      messages: buildTranslationMessages(request),
      temperature: 0.1,
      stream: Boolean(request.stream)
    })
  });

  if (
    request.stream &&
    response.ok &&
    response.headers.get("content-type")?.includes("text/event-stream")
  ) {
    return readCompatibleTranslationStream(response, request, provider, model, startedAtMs, onDraft);
  }

  const payload = (await response.json()) as ChatCompletionOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw createProviderRequestError(response, payload);
  }

  return {
    text: readChatCompletionText(payload),
    provider,
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

function getCustomTranslationKey(): string {
  return (
    process.env.CUSTOM_TRANSLATION_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  );
}

async function translateWithConfiguredProvider(
  request: TranslateTextRequest,
  signal?: AbortSignal,
  onDraft?: (draft: TranslationDraftResponse) => void
): Promise<TranslateTextResponse> {
  const runtimeConfig = getAiRuntimeConfig();
  const model = request.model || runtimeConfig.translationModel;

  if (runtimeConfig.translationProvider === "openai") {
    return translateWithOpenAi(request, runtimeConfig, signal);
  }

  if (runtimeConfig.translationProvider === "deepseek") {
    return translateWithOpenAiCompatible(
      request,
      "deepseek",
      getDeepSeekKey(),
      runtimeConfig.translationBaseUrl,
      model,
      signal,
      onDraft
    );
  }

  if (runtimeConfig.translationProvider === "aliyun") {
    return translateWithOpenAiCompatible(
      request,
      "aliyun",
      getDashScopeKey(),
      runtimeConfig.translationBaseUrl,
      model,
      signal,
      onDraft
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
      model,
      signal,
      onDraft
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

/**
 * Heights match the overlay's reserved line budget (previous line, two source lines,
 * three translation lines) measured at each preset width, so the window opens at the
 * size it will hold rather than resizing itself on the first caption.
 */
function getFloatingWindowSize(layout: FloatingCaptionLayout): { width: number; height: number } {
  if (layout === "compact") {
    return { width: 460, height: 257 };
  }

  if (layout === "wide") {
    return { width: 760, height: 307 };
  }

  return { width: 620, height: 302 };
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

async function refineWithOpenAi(
  request: RefineSubtitleRequest,
  runtimeConfig = getAiRuntimeConfig()
): Promise<RefineSubtitleResponse> {
  const startedAtMs = Date.now();
  const model = request.model || runtimeConfig.refinementModel;

  const response = await fetch(buildProviderEndpoint(runtimeConfig.refinementBaseUrl, "/responses"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: buildSubtitleRefinementMessages(request)
    })
  });

  const payload = (await response.json()) as OpenAiResponseOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw new Error(readOpenAiError(payload));
  }

  return {
    ...parseSubtitleRefinementJson(readOpenAiOutputText(payload)),
    provider: "openai",
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

async function refineWithOpenAiCompatible(
  request: RefineSubtitleRequest,
  provider: "deepseek" | "aliyun" | "custom",
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<RefineSubtitleResponse> {
  const startedAtMs = Date.now();
  const response = await fetch(buildProviderEndpoint(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: buildSubtitleRefinementMessages(request),
      temperature: 0.15
    })
  });

  const payload = (await response.json()) as ChatCompletionOutput & OpenAiErrorResponse;

  if (!response.ok) {
    throw new Error(readOpenAiError(payload));
  }

  return {
    ...parseSubtitleRefinementJson(readChatCompletionText(payload)),
    provider,
    model,
    latencyMs: Date.now() - startedAtMs
  };
}

async function refineWithConfiguredProvider(
  request: RefineSubtitleRequest
): Promise<RefineSubtitleResponse> {
  const runtimeConfig = getAiRuntimeConfig();
  const model = request.model || runtimeConfig.refinementModel;

  if (runtimeConfig.refinementProvider === "openai") {
    return refineWithOpenAi(request, runtimeConfig);
  }

  if (runtimeConfig.refinementProvider === "deepseek") {
    return refineWithOpenAiCompatible(
      request,
      "deepseek",
      getDeepSeekKey(),
      runtimeConfig.refinementBaseUrl,
      model
    );
  }

  if (runtimeConfig.refinementProvider === "aliyun") {
    return refineWithOpenAiCompatible(
      request,
      "aliyun",
      getDashScopeKey(),
      runtimeConfig.refinementBaseUrl,
      model
    );
  }

  if (runtimeConfig.refinementProvider === "custom") {
    const apiKey = getCustomTranslationKey();

    if (!apiKey) {
      throw new Error("请先在 .env 中配置 CUSTOM_TRANSLATION_API_KEY 或可复用的文本 provider Key。");
    }

    return refineWithOpenAiCompatible(
      request,
      "custom",
      apiKey,
      runtimeConfig.refinementBaseUrl,
      model
    );
  }

  throw new Error("当前润色 provider 未启用。");
}

function setFloatingCaptionInteraction(options: {
  locked: boolean;
  mousePassthrough: boolean;
}): void {
  setFloatingCaptionMouseIgnore(options.locked && options.mousePassthrough);
}

/**
 * Toggling ignore-mouse-events on its own lets the overlay temporarily accept a
 * click on its unlock chip without disturbing the persisted lock preference.
 */
function setFloatingCaptionMouseIgnore(ignore: boolean): void {
  if (!floatingCaptionWindow || floatingCaptionWindow.isDestroyed()) {
    return;
  }

  floatingCaptionWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function getFloatingWindowWorkArea(window: BrowserWindow): Electron.Rectangle {
  return screen.getDisplayMatching(window.getBounds()).workArea;
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
  if (!floatingCaptionWindow || floatingCaptionWindow.isDestroyed() || !latestFloatingCaptionContent) {
    return;
  }

  floatingCaptionWindow.webContents.send(
    "floating-caption:update",
    mergeFloatingCaptionState(latestFloatingCaptionContent, floatingCaptionPreferences)
  );
}

function createMainWindow(): void {
  const window = new BrowserWindow({
    width: 820,
    height: 520,
    minWidth: 680,
    minHeight: 420,
    title: "同声传译",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The capture loop, payload queue, and translation scheduler all run in this
      // renderer. Chromium throttles background timers to ~1Hz, which would stall
      // interpretation whenever the user works elsewhere and reads only the overlay.
      backgroundThrottling: false
    }
  });
  window.setMenu(null);
  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (isDev) {
    void window.loadURL("http://127.0.0.1:5173");
    return;
  }

  void window.loadFile(path.join(__dirname, "../dist/index.html"));
}

function createFloatingCaptionWindow(options = defaultFloatingOptions): BrowserWindow {
  latestFloatingOptions = options;

  if (floatingCaptionWindow && !floatingCaptionWindow.isDestroyed()) {
    floatingCaptionWindow.show();
    floatingCaptionWindow.focus();
    sendFloatingCaptionState();
    return floatingCaptionWindow;
  }

  floatingCaptionWindow = new BrowserWindow({
    ...getFloatingWindowBounds(options),
    minWidth: FLOATING_MIN_WIDTH,
    minHeight: FLOATING_MIN_HEIGHT,
    title: "Floating Caption",
    frame: false,
    // Electron documents that transparent windows should not be resizable, so width
    // is stepped from the overlay controls and height tracks the caption content.
    resizable: false,
    movable: true,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  floatingCaptionWindow.setAlwaysOnTop(true, "screen-saver");
  floatingCaptionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingCaptionWindow.on("closed", () => {
    floatingCaptionWindow = null;
  });
  floatingCaptionWindow.webContents.on("did-finish-load", () => {
    setFloatingCaptionInteraction(floatingCaptionPreferences);
    sendFloatingCaptionState();
  });
  loadFloatingCaptionWindow(floatingCaptionWindow);
  floatingCaptionWindow.on("moved", () => sendFloatingCaptionState());

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

  return sources
    .map((source) => ({
      id: source.id,
      name: source.name
    }))
    .sort((left, right) => {
      const leftIsScreen = left.id.startsWith("screen:");
      const rightIsScreen = right.id.startsWith("screen:");

      if (leftIsScreen === rightIsScreen) {
        return left.name.localeCompare(right.name, "zh-CN");
      }

      return leftIsScreen ? -1 : 1;
    });
});

ipcMain.handle(
  "dialog:export-subtitle-history",
  async (_event, content: string, suggestedName: string) => {
    if (typeof content !== "string" || typeof suggestedName !== "string") {
      throw new Error("Invalid subtitle history export request.");
    }

    const result = await dialog.showSaveDialog({
      title: "导出字幕历史",
      defaultPath: suggestedName,
      filters: [{ name: "Text", extensions: ["txt"] }]
    });
    if (result.canceled || !result.filePath) return false;

    await writeFile(result.filePath, content, "utf8");
    return true;
  }
);

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
  latestFloatingOptions = options;
  const window = createFloatingCaptionWindow(options);
  window.setBounds(getFloatingWindowBounds(options), true);
  return {
    visible: true,
    bounds: window.getBounds()
  };
});

ipcMain.handle(
  "floating-caption:set-interaction",
  (_event, options: { locked: boolean; mousePassthrough: boolean }) => {
    floatingCaptionPreferences = normalizeFloatingCaptionPreferences(
      options,
      floatingCaptionPreferences
    );
    setFloatingCaptionInteraction(floatingCaptionPreferences);
    sendFloatingCaptionState();
    return {
      visible: Boolean(floatingCaptionWindow && !floatingCaptionWindow.isDestroyed()),
      bounds: floatingCaptionWindow?.isDestroyed() ? undefined : floatingCaptionWindow?.getBounds()
    };
  }
);

ipcMain.handle("floating-caption:reset", () => {
  const window = createFloatingCaptionWindow(latestFloatingOptions);
  window.setBounds(getFloatingWindowBounds(latestFloatingOptions), true);
  floatingCaptionPreferences = {
    ...floatingCaptionPreferences,
    locked: false,
    mousePassthrough: false
  };
  window.setIgnoreMouseEvents(false);
  sendFloatingCaptionState();
  return {
    visible: true,
    bounds: window.getBounds()
  };
});

ipcMain.on("floating-caption:update", (_event, state: FloatingCaptionState) => {
  latestFloatingCaptionContent = extractFloatingCaptionContent(state);
  sendFloatingCaptionState();
});

ipcMain.on(
  "floating-caption:set-preferences",
  (_event, preferences: Partial<FloatingCaptionPreferences>) => {
    floatingCaptionPreferences = normalizeFloatingCaptionPreferences(
      preferences,
      floatingCaptionPreferences
    );
    setFloatingCaptionInteraction(floatingCaptionPreferences);
    sendFloatingCaptionState();
  }
);

ipcMain.on("floating-caption:set-mouse-ignore", (_event, ignore: boolean) => {
  setFloatingCaptionMouseIgnore(Boolean(ignore));
});

ipcMain.on("floating-caption:command", (_event, command: FloatingCaptionCommand) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("floating-caption:command", command);
});

ipcMain.on("floating-caption:resize", (_event, contentHeight: number) => {
  const window = floatingCaptionWindow;

  if (!window || window.isDestroyed()) {
    return;
  }

  const bounds = window.getBounds();
  const next = resolveFloatingHeight({
    contentHeight,
    bounds,
    workArea: getFloatingWindowWorkArea(window)
  });

  if (next.height === bounds.height && next.y === bounds.y) {
    return;
  }

  window.setBounds(next);
});

ipcMain.handle("floating-caption:adjust-width", (_event, delta: number) => {
  const window = floatingCaptionWindow;

  if (!window || window.isDestroyed()) {
    return { visible: false };
  }

  const bounds = window.getBounds();
  const next = resolveFloatingWidth({
    delta,
    bounds,
    workArea: getFloatingWindowWorkArea(window)
  });

  if (next.width !== bounds.width || next.x !== bounds.x) {
    window.setBounds(next);
  }

  return {
    visible: true,
    bounds: window.getBounds()
  };
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

subscribeRealtimeProviderAsrEvents((event) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("provider:asr-event", event);
});

ipcMain.handle("provider:stop-realtime-session", () => stopRealtimeProviderSession());

const translationControllers = new Map<string, AbortController>();

ipcMain.handle("ai:translate-text", async (ipcEvent, request: TranslateTextRequest) => {
  const controller = new AbortController();
  const startedAtMs = Date.now();
  if (request.requestId) {
    translationControllers.set(request.requestId, controller);
  }
  try {
    return await translateWithConfiguredProvider(request, controller.signal, (draft) => {
      if (!ipcEvent.sender.isDestroyed()) {
        ipcEvent.sender.send("ai:translation-draft", draft);
      }
    });
  } catch (error) {
    return createTranslationFailureResponse(request, error, startedAtMs, controller.signal.aborted);
  } finally {
    if (request.requestId) {
      translationControllers.delete(request.requestId);
    }
  }
});

ipcMain.on("ai:cancel-translation", (_event, requestId: string) => {
  translationControllers.get(requestId)?.abort();
});

ipcMain.handle("ai:refine-subtitle", (_event, request: RefineSubtitleRequest) =>
  refineWithConfiguredProvider(request)
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
