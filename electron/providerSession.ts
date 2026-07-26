import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import net from "node:net";
import tls from "node:tls";

type RealtimeAsrProvider = "mock" | "openai" | "aliyun" | "custom";
type TranslationProvider = "mock" | "openai" | "deepseek" | "aliyun" | "custom";
type ProviderConnectionState =
  | "idle"
  | "ready"
  | "missing-config"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "degraded"
  | "closing"
  | "closed"
  | "error";

interface RealtimeWebSocketHeaders {
  [name: string]: string;
}

interface RealtimeWebSocketOptions {
  url: string;
  headers: RealtimeWebSocketHeaders;
  timeoutMs: number;
}

export interface ProviderRuntimeConfig {
  asrProvider: RealtimeAsrProvider;
  asrModel: string;
  asrBaseUrl: string;
  translationProvider: TranslationProvider;
  translationModel: string;
  fastDraftModel: string;
  fastDraftStreaming: boolean;
  translationBaseUrl: string;
  refinementProvider: TranslationProvider;
  refinementModel: string;
  refinementBaseUrl: string;
  hasOpenAiKey: boolean;
  hasDeepSeekKey: boolean;
  hasDashScopeKey: boolean;
  realtimeEnabled: boolean;
  canStartRealtime: boolean;
  missing: string[];
  secretsInRenderer: false;
  loadedAtMs: number;
}

export interface RealtimeProviderQueueSnapshot {
  depth: number;
  maxDepth: number;
  dropped: number;
  lastSequence: number | null;
  lastPayloadBytes: number;
}

export interface RealtimeProviderSessionState {
  state: ProviderConnectionState;
  sessionId: string | null;
  sourceType: "system" | "microphone" | null;
  languagePairId: string | null;
  asrProvider: RealtimeAsrProvider;
  translationProvider: TranslationProvider;
  queue: RealtimeProviderQueueSnapshot;
  timing: {
    correlatedEvents: number;
    uncorrelatedEvents: number;
  };
  recentLatencyMs: number | null;
  error: string | null;
  startedAtMs: number | null;
  updatedAtMs: number;
}

export interface ProviderHealth {
  config: ProviderRuntimeConfig;
  session: RealtimeProviderSessionState;
}

export interface StartRealtimeProviderSessionRequest {
  sourceType: "system" | "microphone";
  languagePairId: string;
  sourceLanguageCode?: string;
  queue: RealtimeProviderQueueSnapshot;
}

export interface RealtimeProviderAudioPayload {
  encoding: "pcm16-base64";
  sampleFormat: "s16le";
  sampleRate: number;
  channels: number;
  frameCount: number;
  byteLength: number;
  durationMs: number;
  data: string;
}

export interface AppendRealtimeProviderAudioChunkRequest {
  id: string;
  sourceType: "system" | "microphone";
  sequence: number;
  timestampMs: number;
  capturedAtMs?: number;
  durationMs: number;
  volume: number;
  queue: RealtimeProviderQueueSnapshot;
  payload: RealtimeProviderAudioPayload;
}

export interface RealtimeProviderAsrEvent {
  id: string;
  segmentId: string;
  chunkId: string;
  sourceType: "system" | "microphone";
  sequence: number;
  audioStartMs: number;
  audioEndMs: number;
  text: string;
  status: "partial" | "final";
  revision: number;
  receivedAtMs: number;
  audioEvidenceEndAtMs: number | null;
  asrReceivedAtMs: number;
  timingCorrelation: "provider-offset" | "segment-revision" | "missing";
  latencyMs: number;
  provider: RealtimeAsrProvider;
  model: string;
}

export interface AppendRealtimeProviderAudioChunkResponse {
  health: ProviderHealth;
  events: RealtimeProviderAsrEvent[];
}

interface OpenAiRealtimeMessage {
  type?: string;
  error?: {
    message?: string;
  };
  delta?: string;
  transcript?: string;
  item_id?: string;
  item?: {
    id?: string;
  };
}

interface AliyunRealtimeMessage {
  header?: {
    task_id?: string;
    event?: string;
    error_code?: string;
    error_message?: string;
  };
  payload?: {
    output?: {
      sentence?: {
        begin_time?: number;
        end_time?: number;
        text?: string;
        heartbeat?: boolean;
        sentence_end?: boolean;
        sentence_id?: number;
      };
    };
  };
}

interface AliyunMappedEvent {
  event: "task-started" | "task-finished" | "task-failed" | "result-generated";
  segmentId?: string;
  text?: string;
  status?: "partial" | "final";
  audioStartMs?: number;
  audioEndMs?: number;
  error?: string;
}

interface SegmentAccumulator {
  id: string;
  text: string;
  revision: number;
  firstChunk: AppendRealtimeProviderAudioChunkRequest | null;
  latestChunk: AppendRealtimeProviderAudioChunkRequest | null;
  latestStatus: "partial" | "final";
  finalizeTimer: NodeJS.Timeout | null;
}

const ALIYUN_PARTIAL_FINALIZE_DELAY_MS = 1600;

const defaultQueue: RealtimeProviderQueueSnapshot = {
  depth: 0,
  maxDepth: 12,
  dropped: 0,
  lastSequence: null,
  lastPayloadBytes: 0
};

let sessionState: RealtimeProviderSessionState = createIdleSessionState();
let websocket: MinimalRealtimeWebSocket | null = null;
let lastStartRequest: StartRealtimeProviderSessionRequest | null = null;
let currentConfig: ProviderRuntimeConfig | null = null;
let retryAttempts = 0;
let userStopped = false;
let pendingAsrEvents: RealtimeProviderAsrEvent[] = [];
let audioEvidenceChunks: AppendRealtimeProviderAudioChunkRequest[] = [];
let aliyunTaskId: string | null = null;
let aliyunTaskStarted = false;
const segments = new Map<string, SegmentAccumulator>();
const AUDIO_EVIDENCE_BUFFER_LIMIT = 96;
const providerAsrEvents = new EventEmitter();

function clearSegmentFinalizeTimers(): void {
  segments.forEach((segment) => {
    if (segment.finalizeTimer) {
      clearTimeout(segment.finalizeTimer);
    }
  });
}

export class MinimalRealtimeWebSocket extends EventEmitter {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private connected = false;
  private handshakeBuffer = Buffer.alloc(0);
  private frameBuffer = Buffer.alloc(0);
  private fragmentedOpcode: number | null = null;
  private fragmentedPayloads: Buffer[] = [];
  private readonly key = randomBytes(16).toString("base64");

  async connect(options: RealtimeWebSocketOptions): Promise<void> {
    const url = new URL(options.url);
    const isSecure = url.protocol === "wss:";
    const port = Number(url.port || (isSecure ? 443 : 80));
    const path = `${url.pathname}${url.search || ""}`;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Realtime ASR 连接超时。"));
        this.close();
      }, options.timeoutMs);

      const handleError = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };

      const writeHandshake = () => {
        const requestHeaders = [
          `GET ${path} HTTP/1.1`,
          `Host: ${url.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${this.key}`,
          "Sec-WebSocket-Version: 13",
          ...Object.entries(options.headers).map(([name, value]) => `${name}: ${value}`),
          "",
          ""
        ];

        this.socket?.write(requestHeaders.join("\r\n"));
      };

      this.socket = isSecure
        ? tls.connect({ host: url.hostname, port, servername: url.hostname }, writeHandshake)
        : net.connect({ host: url.hostname, port }, writeHandshake);

      this.socket.once("error", handleError);
      this.socket.on("data", (chunk) => this.handleData(chunk, resolve, reject, timeout));
      this.socket.on("close", () => {
        const shouldNotify = this.connected;
        this.connected = false;
        this.socket = null;
        if (shouldNotify) {
          this.emit("close");
        }
      });

    });
  }

  sendJson(payload: unknown): void {
    this.sendFrame(0x1, Buffer.from(JSON.stringify(payload), "utf8"));
  }

  sendBinary(payload: Buffer): void {
    this.sendFrame(0x2, payload);
  }

  close(): void {
    if (this.socket && !this.socket.destroyed) {
      if (this.connected) {
        this.sendFrame(0x8, Buffer.alloc(0));
      }
      this.socket.end();
      this.socket.destroy();
    }
    this.socket = null;
    this.connected = false;
  }

  private handleData(
    chunk: Buffer,
    resolve: () => void,
    reject: (error: Error) => void,
    timeout: NodeJS.Timeout
  ): void {
    if (!this.connected) {
      this.handshakeBuffer = Buffer.concat([this.handshakeBuffer, chunk]);
      const marker = this.handshakeBuffer.indexOf("\r\n\r\n");
      if (marker === -1) {
        return;
      }

      const headerText = this.handshakeBuffer.slice(0, marker).toString("utf8");
      const remainder = this.handshakeBuffer.slice(marker + 4);

      if (!headerText.startsWith("HTTP/1.1 101")) {
        clearTimeout(timeout);
        reject(new Error(`Realtime ASR 握手失败：${headerText.split("\r\n")[0]}`));
        this.close();
        return;
      }

      clearTimeout(timeout);
      this.connected = true;
      this.socket?.removeAllListeners("error");
      this.socket?.on("error", (error) => this.emit("error", error));
      resolve();

      if (remainder.length > 0) {
        this.frameBuffer = Buffer.concat([this.frameBuffer, remainder]);
        this.readFrames();
      }
      return;
    }

    this.frameBuffer = Buffer.concat([this.frameBuffer, chunk]);
    this.readFrames();
  }

  private readFrames(): void {
    while (this.frameBuffer.length >= 2) {
      const final = Boolean(this.frameBuffer[0] & 0x80);
      const opcode = this.frameBuffer[0] & 0x0f;
      const masked = Boolean(this.frameBuffer[1] & 0x80);
      let offset = 2;
      let payloadLength = this.frameBuffer[1] & 0x7f;

      if (payloadLength === 126) {
        if (this.frameBuffer.length < offset + 2) {
          return;
        }
        payloadLength = this.frameBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.frameBuffer.length < offset + 8) {
          return;
        }
        const high = this.frameBuffer.readUInt32BE(offset);
        const low = this.frameBuffer.readUInt32BE(offset + 4);
        payloadLength = high * 2 ** 32 + low;
        offset += 8;
      }

      const maskLength = masked ? 4 : 0;
      if (this.frameBuffer.length < offset + maskLength + payloadLength) {
        return;
      }

      let payload = this.frameBuffer.slice(offset + maskLength, offset + maskLength + payloadLength);
      if (masked) {
        const mask = this.frameBuffer.slice(offset, offset + 4);
        const decodedPayload = Buffer.alloc(payload.length);
        payload.forEach((byte, index) => {
          decodedPayload[index] = byte ^ mask[index % 4];
        });
        payload = decodedPayload;
      }

      this.frameBuffer = this.frameBuffer.slice(offset + maskLength + payloadLength);

      if (opcode === 0x1 || opcode === 0x2) {
        if (final) {
          if (opcode === 0x1) {
            this.emit("message", payload.toString("utf8"));
          }
        } else {
          this.fragmentedOpcode = opcode;
          this.fragmentedPayloads = [payload];
        }
      } else if (opcode === 0x0 && this.fragmentedOpcode !== null) {
        this.fragmentedPayloads.push(payload);
        if (final) {
          const completePayload = Buffer.concat(this.fragmentedPayloads);
          if (this.fragmentedOpcode === 0x1) {
            this.emit("message", completePayload.toString("utf8"));
          }
          this.fragmentedOpcode = null;
          this.fragmentedPayloads = [];
        }
      } else if (opcode === 0x8) {
        this.sendFrame(0x8, payload);
        this.socket?.end();
        this.socket?.destroy();
      } else if (opcode === 0x9) {
        this.sendFrame(0xA, payload);
      }
    }
  }

  private sendFrame(opcode: number, payload: Buffer): void {
    if (!this.socket || this.socket.destroyed) {
      return;
    }

    const mask = randomBytes(4);
    let header: Buffer;

    if (payload.length <= 125) {
      header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    } else if (payload.length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
    }

    const maskedPayload = payload.map((byte, index) => byte ^ mask[index % 4]);
    this.socket.write(Buffer.concat([header, mask, maskedPayload]));
  }
}

function createIdleSessionState(): RealtimeProviderSessionState {
  const config = getProviderRuntimeConfig();

  return {
    state: config.realtimeEnabled ? "ready" : "idle",
    sessionId: null,
    sourceType: null,
    languagePairId: null,
    asrProvider: config.asrProvider,
    translationProvider: config.translationProvider,
    queue: defaultQueue,
    timing: {
      correlatedEvents: 0,
      uncorrelatedEvents: 0
    },
    recentLatencyMs: null,
    error: null,
    startedAtMs: null,
    updatedAtMs: Date.now()
  };
}

function readEnv(name: string, fallback = ""): string {
  return (process.env[name] || fallback).trim();
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = readEnv(name).toLowerCase();
  if (!value) {
    return fallback;
  }
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function normalizeAsrProvider(value: string): RealtimeAsrProvider {
  if (value === "openai" || value === "aliyun" || value === "custom") {
    return value;
  }

  return "mock";
}

function normalizeTranslationProvider(value: string): TranslationProvider {
  if (value === "openai" || value === "deepseek" || value === "aliyun" || value === "custom") {
    return value;
  }

  return "mock";
}

function getOpenAiRealtimeUrl(config: ProviderRuntimeConfig): string {
  if (config.asrBaseUrl.startsWith("wss://") || config.asrBaseUrl.startsWith("ws://")) {
    return config.asrBaseUrl.includes("intent=")
      ? config.asrBaseUrl
      : `${config.asrBaseUrl}${config.asrBaseUrl.includes("?") ? "&" : "?"}intent=transcription`;
  }

  const wsBaseUrl = config.asrBaseUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const base = wsBaseUrl.endsWith("/") ? wsBaseUrl.slice(0, -1) : wsBaseUrl;
  return `${base}/realtime?intent=transcription`;
}

function getOpenAiKey(): string {
  const apiKey = readEnv("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("缺少本地配置：OPENAI_API_KEY");
  }

  return apiKey;
}

function getDashScopeKey(): string {
  const apiKey = readEnv("DASHSCOPE_API_KEY");

  if (!apiKey) {
    throw new Error("缺少本地配置：DASHSCOPE_API_KEY");
  }

  return apiKey;
}

function decodePcm16Base64(value: string): Int16Array {
  const bytes = Buffer.from(value, "base64");
  const samples = new Int16Array(bytes.byteLength / 2);

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = bytes.readInt16LE(index * 2);
  }

  return samples;
}

function encodePcm16Base64(samples: Int16Array): string {
  const bytes = Buffer.alloc(samples.length * 2);

  samples.forEach((sample, index) => {
    bytes.writeInt16LE(sample, index * 2);
  });

  return bytes.toString("base64");
}

function encodePcm16Buffer(samples: Int16Array): Buffer {
  const bytes = Buffer.alloc(samples.length * 2);

  samples.forEach((sample, index) => {
    bytes.writeInt16LE(sample, index * 2);
  });

  return bytes;
}

function downmixPcm16(samples: Int16Array, channels: number): Int16Array {
  if (channels <= 1) {
    return samples;
  }

  const frameCount = Math.floor(samples.length / channels);
  const output = new Int16Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    let total = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      total += samples[frame * channels + channel];
    }
    output[frame] = Math.round(total / channels);
  }

  return output;
}

function resamplePcm16(samples: Int16Array, sourceRate: number, targetRate: number): Int16Array {
  if (sourceRate === targetRate) {
    return samples;
  }

  const targetLength = Math.max(1, Math.round((samples.length * targetRate) / sourceRate));
  const output = new Int16Array(targetLength);
  const ratio = sourceRate / targetRate;

  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(samples.length - 1, left + 1);
    const fraction = sourceIndex - left;
    output[index] = Math.round(samples[left] * (1 - fraction) + samples[right] * fraction);
  }

  return output;
}

function toOpenAiAudio(payload: RealtimeProviderAudioPayload): string {
  const samples = decodePcm16Base64(payload.data);
  return encodePcm16Base64(resamplePcm16(samples, payload.sampleRate, 24000));
}

function toAliyunAudio(payload: RealtimeProviderAudioPayload): Buffer {
  const samples = decodePcm16Base64(payload.data);
  const mono = downmixPcm16(samples, payload.channels);
  return encodePcm16Buffer(resamplePcm16(mono, payload.sampleRate, 16000));
}

function updateSessionState(nextState: Partial<RealtimeProviderSessionState>): void {
  sessionState = {
    ...sessionState,
    ...nextState,
    updatedAtMs: Date.now()
  };
}

function buildSegmentId(message: OpenAiRealtimeMessage): string {
  return message.item_id || message.item?.id || "provider-live-segment";
}

export function selectAudioEvidenceChunk(
  chunks: AppendRealtimeProviderAudioChunkRequest[],
  providerAudioEndMs?: number
): AppendRealtimeProviderAudioChunkRequest | null {
  if (chunks.length === 0) {
    return null;
  }

  if (Number.isFinite(providerAudioEndMs)) {
    const endMs = providerAudioEndMs as number;
    const containing = chunks.find(
      (chunk) => chunk.timestampMs <= endMs && chunk.timestampMs + chunk.durationMs >= endMs
    );
    if (containing) {
      return containing;
    }

    const preceding = chunks.filter((chunk) => chunk.timestampMs + chunk.durationMs <= endMs).at(-1);
    if (preceding) {
      return preceding;
    }
  }

  return chunks.at(-1) ?? null;
}

function buildProviderEvent(
  segmentId: string,
  text: string,
  status: "partial" | "final",
  providerAudioStartMs?: number,
  providerAudioEndMs?: number
): RealtimeProviderAsrEvent | null {
  if (!currentConfig || !sessionState.sessionId) {
    return null;
  }

  const existing = segments.get(segmentId);
  const evidenceChunk = selectAudioEvidenceChunk(audioEvidenceChunks, providerAudioEndMs);
  const accumulator: SegmentAccumulator =
    existing ??
    {
      id: segmentId,
      text: "",
      revision: 0,
      firstChunk: evidenceChunk,
      latestChunk: evidenceChunk,
      latestStatus: "partial",
      finalizeTimer: null
    };

  accumulator.text = text;
  accumulator.revision += 1;
  accumulator.firstChunk ??= evidenceChunk;
  accumulator.latestChunk = evidenceChunk ?? accumulator.latestChunk;
  accumulator.latestStatus = status;
  segments.set(segmentId, accumulator);

  const receivedAtMs = Date.now();
  const audioEvidenceEndAtMs = accumulator.latestChunk?.capturedAtMs ?? null;
  const correlated = audioEvidenceEndAtMs !== null;
  const sourceType = accumulator.latestChunk?.sourceType ?? sessionState.sourceType;

  if (!sourceType) {
    return null;
  }

  return {
    id: `${segmentId}-${status}-${accumulator.revision}`,
    segmentId,
    chunkId: accumulator.latestChunk?.id ?? `uncorrelated-${segmentId}-${accumulator.revision}`,
    sourceType,
    sequence: accumulator.latestChunk?.sequence ?? -1,
    audioStartMs: providerAudioStartMs ?? accumulator.firstChunk?.timestampMs ?? 0,
    audioEndMs:
      providerAudioEndMs ??
      (accumulator.latestChunk
        ? accumulator.latestChunk.timestampMs + accumulator.latestChunk.durationMs
        : 0),
    text,
    status,
    revision: accumulator.revision,
    receivedAtMs,
    audioEvidenceEndAtMs,
    asrReceivedAtMs: receivedAtMs,
    timingCorrelation: correlated
      ? Number.isFinite(providerAudioEndMs)
        ? "provider-offset"
        : "segment-revision"
      : "missing",
    latencyMs: correlated ? Math.max(0, receivedAtMs - audioEvidenceEndAtMs) : 0,
    provider: currentConfig.asrProvider,
    model: currentConfig.asrModel
  };
}

export function bufferRealtimeProviderAsrEvent(event: RealtimeProviderAsrEvent): void {
  pendingAsrEvents.push(event);
  providerAsrEvents.emit("event", event);
  updateSessionState({
    recentLatencyMs: event.audioEvidenceEndAtMs === null ? sessionState.recentLatencyMs : event.latencyMs,
    timing: {
      correlatedEvents:
        sessionState.timing.correlatedEvents + (event.audioEvidenceEndAtMs === null ? 0 : 1),
      uncorrelatedEvents:
        sessionState.timing.uncorrelatedEvents + (event.audioEvidenceEndAtMs === null ? 1 : 0)
    },
    error: null
  });
}

export function subscribeRealtimeProviderAsrEvents(
  listener: (event: RealtimeProviderAsrEvent) => void
): () => void {
  providerAsrEvents.on("event", listener);
  return () => providerAsrEvents.off("event", listener);
}

function scheduleAliyunPartialFinalization(segmentId: string): void {
  const accumulator = segments.get(segmentId);

  if (!accumulator || accumulator.latestStatus === "final") {
    return;
  }

  if (accumulator.finalizeTimer) {
    clearTimeout(accumulator.finalizeTimer);
  }

  accumulator.finalizeTimer = setTimeout(() => {
    const latest = segments.get(segmentId);

    if (!latest || latest.latestStatus === "final" || !latest.text.trim()) {
      return;
    }

    const event = buildProviderEvent(
      segmentId,
      latest.text,
      "final",
      latest.firstChunk?.timestampMs,
      latest.latestChunk
        ? latest.latestChunk.timestampMs + latest.latestChunk.durationMs
        : undefined
    );
    if (event) {
      const finalized = segments.get(segmentId);
      if (finalized) {
        finalized.latestStatus = "final";
        finalized.finalizeTimer = null;
      }
      bufferRealtimeProviderAsrEvent(event);
    }
  }, ALIYUN_PARTIAL_FINALIZE_DELAY_MS);
}

export function createAliyunRunTaskMessage(
  taskId: string,
  model: string,
  sourceLanguageCode?: string
): unknown {
  const languageCode = sourceLanguageCode?.toLowerCase().startsWith("zh")
    ? "zh"
    : sourceLanguageCode?.toLowerCase().startsWith("en")
      ? "en"
      : undefined;

  return {
    header: {
      action: "run-task",
      task_id: taskId,
      streaming: "duplex"
    },
    payload: {
      task_group: "audio",
      task: "asr",
      function: "recognition",
      model,
      parameters: {
        format: "pcm",
        sample_rate: 16000,
        ...(languageCode ? { language_hints: [languageCode] } : {}),
        heartbeat: true
      },
      input: {}
    }
  };
}

function createAliyunFinishTaskMessage(taskId: string): unknown {
  return {
    header: {
      action: "finish-task",
      task_id: taskId,
      streaming: "duplex"
    },
    payload: {
      input: {}
    }
  };
}

export function mapAliyunRealtimeMessage(messageText: string): AliyunMappedEvent | null {
  let message: AliyunRealtimeMessage;

  try {
    message = JSON.parse(messageText) as AliyunRealtimeMessage;
  } catch {
    return null;
  }

  const event = message.header?.event;

  if (event === "task-started") {
    return { event };
  }

  if (event === "task-finished") {
    return { event };
  }

  if (event === "task-failed") {
    return {
      event,
      error:
        message.header?.error_message ||
        message.header?.error_code ||
        "Aliyun realtime ASR task failed."
    };
  }

  if (event !== "result-generated") {
    return null;
  }

  const sentence = message.payload?.output?.sentence;

  if (!sentence || sentence.heartbeat || !sentence.text?.trim()) {
    return null;
  }

  return {
    event,
    segmentId: `aliyun-sentence-${sentence.sentence_id ?? message.header?.task_id ?? "live"}`,
    text: sentence.text.trim(),
    status: sentence.sentence_end ? "final" : "partial",
    ...(Number.isFinite(sentence.begin_time) ? { audioStartMs: sentence.begin_time } : {}),
    ...(Number.isFinite(sentence.end_time) ? { audioEndMs: sentence.end_time } : {})
  };
}

function handleOpenAiMessage(messageText: string): void {
  let message: OpenAiRealtimeMessage;

  try {
    message = JSON.parse(messageText) as OpenAiRealtimeMessage;
  } catch {
    return;
  }
  retryAttempts = 0;

  if (message.type === "error") {
    updateSessionState({
      state: "error",
      error: message.error?.message || "Realtime ASR 返回错误。"
    });
    return;
  }

  if (message.type === "conversation.item.input_audio_transcription.delta" && message.delta) {
    const segmentId = buildSegmentId(message);
    const currentText = `${segments.get(segmentId)?.text ?? ""}${message.delta}`;
    const event = buildProviderEvent(segmentId, currentText, "partial");
    if (event) {
      bufferRealtimeProviderAsrEvent(event);
    }
  }

  if (
    message.type === "conversation.item.input_audio_transcription.completed" &&
    message.transcript
  ) {
    const event = buildProviderEvent(buildSegmentId(message), message.transcript, "final");
    if (event) {
      bufferRealtimeProviderAsrEvent(event);
    }
  }

  if (message.type === "conversation.item.input_audio_transcription.failed") {
    updateSessionState({
      state: "error",
      error: message.error?.message || "Realtime ASR 转写失败。"
    });
  }
}

function handleAliyunMessage(messageText: string): void {
  const mapped = mapAliyunRealtimeMessage(messageText);

  if (!mapped) {
    return;
  }

  if (mapped.event === "task-started") {
    retryAttempts = 0;
    aliyunTaskStarted = true;
    updateSessionState({ state: "streaming", error: null });
    return;
  }

  if (mapped.event === "task-finished") {
    updateSessionState({
      state: userStopped ? "closed" : "streaming",
      error: null
    });
    return;
  }

  if (mapped.event === "task-failed") {
    updateSessionState({
      state: "error",
      error: mapped.error || "Aliyun realtime ASR task failed."
    });
    return;
  }

  if (mapped.text && mapped.segmentId && mapped.status) {
    const event = buildProviderEvent(
      mapped.segmentId,
      mapped.text,
      mapped.status,
      mapped.audioStartMs,
      mapped.audioEndMs
    );
    if (event) {
      bufferRealtimeProviderAsrEvent(event);
      if (mapped.status === "partial") {
        scheduleAliyunPartialFinalization(mapped.segmentId);
      }
    }
  }
}

async function connectOpenAiRealtime(config: ProviderRuntimeConfig): Promise<void> {
  websocket?.close();
  websocket = new MinimalRealtimeWebSocket();

  websocket.on("message", (messageText: string) => handleOpenAiMessage(messageText));
  websocket.on("error", (error: Error) => {
    updateSessionState({
      state: "error",
      error: error.message || "Realtime ASR 连接异常。"
    });
  });
  websocket.on("close", () => {
    if (userStopped || !lastStartRequest || retryAttempts >= 1) {
      updateSessionState({
        state: userStopped ? "closed" : "error",
        sessionId: userStopped ? null : sessionState.sessionId,
        error: userStopped ? null : "Realtime ASR 连接已关闭。"
      });
      return;
    }

    retryAttempts += 1;
    updateSessionState({ state: "reconnecting", error: "Realtime ASR 连接中断，正在重试。" });
    setTimeout(() => {
      if (lastStartRequest && !userStopped) {
        void connectOpenAiRealtime(config).catch((error) => {
          updateSessionState({
            state: "error",
            error: error instanceof Error ? error.message : "Realtime ASR 重连失败。"
          });
        });
      }
    }, 800);
  });

  await websocket.connect({
    url: getOpenAiRealtimeUrl(config),
    headers: {
      Authorization: `Bearer ${getOpenAiKey()}`,
      "OpenAI-Beta": "realtime=v1"
    },
    timeoutMs: 8000
  });

  websocket.sendJson({
    type: "transcription_session.update",
    session: {
      input_audio_format: "pcm16",
      input_audio_transcription: {
        model: config.asrModel,
        language: lastStartRequest?.sourceLanguageCode?.startsWith("zh") ? "zh" : "en"
      },
      turn_detection: {
        type: "server_vad",
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    }
  });
}

async function connectAliyunRealtime(config: ProviderRuntimeConfig): Promise<void> {
  websocket?.close();
  websocket = new MinimalRealtimeWebSocket();
  aliyunTaskId = randomUUID();
  aliyunTaskStarted = false;

  websocket.on("message", (messageText: string) => handleAliyunMessage(messageText));
  websocket.on("error", (error: Error) => {
    updateSessionState({
      state: "error",
      error: error.message || "Aliyun realtime ASR 连接异常。"
    });
  });
  websocket.on("close", () => {
    if (userStopped || !lastStartRequest || retryAttempts >= 1) {
      updateSessionState({
        state: userStopped ? "closed" : "error",
        sessionId: userStopped ? null : sessionState.sessionId,
        error: userStopped ? null : "Aliyun realtime ASR 连接已关闭。"
      });
      return;
    }

    retryAttempts += 1;
    aliyunTaskStarted = false;
    updateSessionState({ state: "reconnecting", error: "Aliyun realtime ASR 连接中断，正在重试。" });
    setTimeout(() => {
      if (lastStartRequest && !userStopped) {
        void connectAliyunRealtime(config).catch((error) => {
          updateSessionState({
            state: "error",
            error: error instanceof Error ? error.message : "Aliyun realtime ASR 重连失败。"
          });
        });
      }
    }, 800);
  });

  await websocket.connect({
    url: config.asrBaseUrl,
    headers: {
      Authorization: `Bearer ${getDashScopeKey()}`,
      "user-agent": "LinguaBridge/0.1.0"
    },
    timeoutMs: 8000
  });

  websocket.sendJson(
    createAliyunRunTaskMessage(aliyunTaskId, config.asrModel, lastStartRequest?.sourceLanguageCode)
  );
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const asrProvider = normalizeAsrProvider(
    readEnv("REALTIME_ASR_PROVIDER", readEnv("VITE_AI_PROVIDER", "mock"))
  );
  const translationProvider = normalizeTranslationProvider(
    readEnv("TRANSLATION_PROVIDER", readEnv("VITE_AI_PROVIDER", "mock"))
  );
  const refinementProvider = normalizeTranslationProvider(
    readEnv("REFINEMENT_PROVIDER", readEnv("TRANSLATION_PROVIDER", readEnv("VITE_AI_PROVIDER", "mock")))
  );
  const hasOpenAiKey = Boolean(readEnv("OPENAI_API_KEY"));
  const hasDeepSeekKey = Boolean(readEnv("DEEPSEEK_API_KEY"));
  const hasDashScopeKey = Boolean(readEnv("DASHSCOPE_API_KEY"));
  const missing: string[] = [];

  if (asrProvider === "openai" && !hasOpenAiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (translationProvider === "openai" && !hasOpenAiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (refinementProvider === "openai" && !hasOpenAiKey) {
    missing.push("OPENAI_API_KEY");
  }

  if (translationProvider === "deepseek" && !hasDeepSeekKey) {
    missing.push("DEEPSEEK_API_KEY");
  }

  if (refinementProvider === "deepseek" && !hasDeepSeekKey) {
    missing.push("DEEPSEEK_API_KEY");
  }

  if (
    (asrProvider === "aliyun" || translationProvider === "aliyun" || refinementProvider === "aliyun") &&
    !hasDashScopeKey
  ) {
    missing.push("DASHSCOPE_API_KEY");
  }

  const realtimeEnabled = asrProvider !== "mock";
  const translationModel =
    readEnv("TRANSLATION_MODEL") ||
    readEnv("VITE_TRANSLATION_MODEL") ||
    (translationProvider === "openai"
      ? "gpt-4.1-mini"
      : translationProvider === "deepseek"
        ? "deepseek-chat"
        : translationProvider === "aliyun"
          ? "qwen-plus"
          : "mock-bilingual-translator");

  return {
    asrProvider,
    asrModel:
      readEnv("REALTIME_ASR_MODEL") ||
      readEnv("VITE_ASR_MODEL") ||
      (asrProvider === "openai"
        ? "gpt-4o-mini-transcribe"
        : asrProvider === "aliyun"
          ? "fun-asr-realtime"
          : "mock-streaming-asr"),
    asrBaseUrl: readEnv(
      "REALTIME_ASR_BASE_URL",
      asrProvider === "aliyun"
        ? "wss://dashscope.aliyuncs.com/api-ws/v1/inference"
        : "https://api.openai.com/v1"
    ),
    translationProvider,
    translationModel,
    fastDraftModel: readEnv("FAST_DRAFT_MODEL") || translationModel,
    fastDraftStreaming: readBooleanEnv("FAST_DRAFT_STREAMING", translationProvider !== "mock"),
    translationBaseUrl:
      readEnv("TRANSLATION_BASE_URL") ||
      (translationProvider === "deepseek"
        ? "https://api.deepseek.com"
        : translationProvider === "aliyun"
          ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
          : "https://api.openai.com/v1"),
    refinementProvider,
    refinementModel:
      readEnv("REFINEMENT_MODEL") ||
      readEnv("TRANSLATION_MODEL") ||
      readEnv("VITE_TRANSLATION_MODEL") ||
      (refinementProvider === "openai"
        ? "gpt-4.1-mini"
        : refinementProvider === "deepseek"
          ? "deepseek-chat"
          : refinementProvider === "aliyun"
            ? "qwen-plus"
            : "mock-subtitle-refiner"),
    refinementBaseUrl:
      readEnv("REFINEMENT_BASE_URL") ||
      readEnv("TRANSLATION_BASE_URL") ||
      (refinementProvider === "deepseek"
        ? "https://api.deepseek.com"
        : refinementProvider === "aliyun"
          ? "https://dashscope.aliyuncs.com/compatible-mode/v1"
          : "https://api.openai.com/v1"),
    hasOpenAiKey,
    hasDeepSeekKey,
    hasDashScopeKey,
    realtimeEnabled,
    canStartRealtime: !realtimeEnabled || missing.length === 0,
    missing: Array.from(new Set(missing)),
    secretsInRenderer: false,
    loadedAtMs: Date.now()
  };
}

export function getProviderHealth(): ProviderHealth {
  const config = getProviderRuntimeConfig();

  if (
    sessionState.sessionId === null &&
    (sessionState.state === "idle" || sessionState.state === "ready")
  ) {
    sessionState = {
      ...sessionState,
      state: config.realtimeEnabled ? "ready" : "idle",
      asrProvider: config.asrProvider,
      translationProvider: config.translationProvider,
      updatedAtMs: Date.now()
    };
  }

  return {
    config,
    session: sessionState
  };
}

export async function startRealtimeProviderSession(
  request: StartRealtimeProviderSessionRequest
): Promise<ProviderHealth> {
  const config = getProviderRuntimeConfig();
  const now = Date.now();
  currentConfig = config;
  lastStartRequest = request;
  userStopped = false;
  retryAttempts = 0;
  pendingAsrEvents = [];
  audioEvidenceChunks = [];
  clearSegmentFinalizeTimers();
  segments.clear();

  if (!config.realtimeEnabled) {
    sessionState = {
      ...createIdleSessionState(),
      queue: request.queue,
      updatedAtMs: now
    };
    return getProviderHealth();
  }

  if (!config.canStartRealtime) {
    sessionState = {
      state: "missing-config",
      sessionId: null,
      sourceType: request.sourceType,
      languagePairId: request.languagePairId,
      asrProvider: config.asrProvider,
      translationProvider: config.translationProvider,
      queue: request.queue,
      timing: { correlatedEvents: 0, uncorrelatedEvents: 0 },
      recentLatencyMs: null,
      error: `缺少本地配置：${config.missing.join(", ")}`,
      startedAtMs: null,
      updatedAtMs: now
    };
    return getProviderHealth();
  }

  if (config.asrProvider !== "openai" && config.asrProvider !== "aliyun") {
    sessionState = {
      state: "error",
      sessionId: null,
      sourceType: request.sourceType,
      languagePairId: request.languagePairId,
      asrProvider: config.asrProvider,
      translationProvider: config.translationProvider,
      queue: request.queue,
      timing: { correlatedEvents: 0, uncorrelatedEvents: 0 },
      recentLatencyMs: null,
      error: "当前只实现 OpenAI realtime ASR streaming。",
      startedAtMs: null,
      updatedAtMs: now
    };
    return getProviderHealth();
  }

  sessionState = {
    state: "connecting",
    sessionId: `provider-session-${now}`,
    sourceType: request.sourceType,
    languagePairId: request.languagePairId,
    asrProvider: config.asrProvider,
    translationProvider: config.translationProvider,
    queue: request.queue,
    timing: { correlatedEvents: 0, uncorrelatedEvents: 0 },
    recentLatencyMs: null,
    error: null,
    startedAtMs: now,
    updatedAtMs: now
  };

  try {
    if (config.asrProvider === "aliyun") {
      await connectAliyunRealtime(config);
    } else {
      await connectOpenAiRealtime(config);
      updateSessionState({ state: "streaming", error: null });
    }
  } catch (error) {
    updateSessionState({
      state: "error",
      sessionId: null,
      error: error instanceof Error ? error.message : "Realtime ASR 连接失败。"
    });
  }

  return getProviderHealth();
}

export function appendRealtimeProviderAudioChunk(
  chunk: AppendRealtimeProviderAudioChunkRequest
): AppendRealtimeProviderAudioChunkResponse {
  audioEvidenceChunks.push(chunk);
  if (audioEvidenceChunks.length > AUDIO_EVIDENCE_BUFFER_LIMIT) {
    audioEvidenceChunks = audioEvidenceChunks.slice(-AUDIO_EVIDENCE_BUFFER_LIMIT);
  }
  updateRealtimeProviderQueueState(chunk.queue);

  if (
    (sessionState.state === "streaming" || sessionState.state === "degraded") &&
    websocket &&
    currentConfig?.asrProvider === "openai"
  ) {
    websocket.sendJson({
      type: "input_audio_buffer.append",
      audio: toOpenAiAudio(chunk.payload)
    });
  }

  if (
    (sessionState.state === "streaming" || sessionState.state === "degraded") &&
    websocket &&
    currentConfig?.asrProvider === "aliyun" &&
    aliyunTaskStarted
  ) {
    websocket.sendBinary(toAliyunAudio(chunk.payload));
  }

  return {
    health: getProviderHealth(),
    events: pullRealtimeProviderAsrEvents()
  };
}

export function pullRealtimeProviderAsrEvents(): RealtimeProviderAsrEvent[] {
  const events = pendingAsrEvents;
  pendingAsrEvents = [];
  return events;
}

export function updateRealtimeProviderQueueState(
  queue: RealtimeProviderQueueSnapshot
): ProviderHealth {
  const overloaded = queue.maxDepth > 0 && queue.depth / queue.maxDepth >= 0.75;

  if (sessionState.sessionId) {
    sessionState = {
      ...sessionState,
      state:
        sessionState.state === "reconnecting" || sessionState.state === "connecting"
          ? sessionState.state
          : overloaded
            ? "degraded"
            : "streaming",
      queue,
      recentLatencyMs: queue.depth > 0 ? queue.depth * 120 : sessionState.recentLatencyMs,
      updatedAtMs: Date.now()
    };
  }

  return getProviderHealth();
}

export function stopRealtimeProviderSession(): ProviderHealth {
  const config = getProviderRuntimeConfig();
  userStopped = true;
  if (websocket && currentConfig?.asrProvider === "aliyun" && aliyunTaskId && aliyunTaskStarted) {
    websocket.sendJson(createAliyunFinishTaskMessage(aliyunTaskId));
  }
  websocket?.close();
  websocket = null;
  aliyunTaskId = null;
  aliyunTaskStarted = false;
  lastStartRequest = null;
  audioEvidenceChunks = [];
  pendingAsrEvents = [];
  clearSegmentFinalizeTimers();
  segments.clear();

  sessionState = {
    ...sessionState,
    state: config.realtimeEnabled ? "closed" : "idle",
    sessionId: null,
    sourceType: null,
    languagePairId: null,
    queue: defaultQueue,
    recentLatencyMs: null,
    error: null,
    updatedAtMs: Date.now()
  };

  return getProviderHealth();
}
