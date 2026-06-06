import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCapturedMicrophoneChunk,
  createCapturedSystemAudioChunk,
  createEmptyPayloadMetadata,
  createPcm16PayloadFromTimeDomainSamples,
  createSimulatedChunk,
  formatTimestamp
} from "./audio/simulator";
import { createStreamingAsrClient } from "./asr/client";
import { loadAsrConfig } from "./asr/config";
import type { AsrEvent, AsrSegment } from "./asr/types";
import {
  getLanguagePair,
  loadPreferredLanguagePair,
  savePreferredLanguagePair,
  supportedLanguagePairs
} from "./language/pairs";
import { createTranslationClient } from "./translation/client";
import type { SubtitleSegment, TranslationEvent, TranslationContextItem } from "./translation/types";
import type { TtsQueueItem, TtsSessionState } from "./tts/types";
import type {
  AudioChunkQueueState,
  AudioSessionState,
  AudioSourceOption,
  AudioSourceType,
  DesktopAudioSource,
  LocalMediaFile,
  MicrophoneDevice,
  NormalizedAudioChunk
} from "./audio/types";

const sourceOptions: AudioSourceOption[] = [
  {
    type: "system",
    label: "系统音频",
    description: "选择屏幕或窗口来源，尝试捕获电脑正在播放的声音。"
  },
  {
    type: "microphone",
    label: "麦克风",
    description: "用于外放会议、现场环境声或临时测试输入。"
  },
  {
    type: "file",
    label: "文件模拟",
    description: "选择本地音频或视频，按实时节奏生成测试音频块。"
  }
];

const AUDIO_PAYLOAD_QUEUE_MAX_DEPTH = 12;

const initialQueueState: AudioChunkQueueState = {
  maxDepth: AUDIO_PAYLOAD_QUEUE_MAX_DEPTH,
  depth: 0,
  dropped: 0,
  lastSequence: null,
  lastPayloadBytes: 0
};

const initialSession: AudioSessionState = {
  sourceType: "system",
  status: "idle",
  selectedFile: null,
  lastChunk: null,
  chunksProduced: 0,
  volume: 0,
  queue: initialQueueState,
  error: null
};

const RECENT_REVISION_WINDOW = 4;
const PROVIDER_TRANSCRIPT_SEGMENT_MS = 2800;

const defaultFloatingCaptionState: FloatingCaptionState = {
  translatedText: "等待字幕",
  sourceText: "开始输入后，这里会显示实时字幕。",
  statusLabel: "等待输入",
  languageDirection: "英语 -> 中文",
  sessionStatus: "idle",
  latencyLabel: "等待字幕",
  revised: false,
  updatedAtMs: Date.now()
};

const initialTtsSession: TtsSessionState = {
  enabled: false,
  status: "disabled",
  queue: [],
  currentItem: null,
  spokenIds: [],
  error: null
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getSourceLabel(type: AudioSourceType): string {
  return sourceOptions.find((option) => option.type === type)?.label ?? type;
}

function getRevisionReasonLabel(reason: SubtitleSegment["revisionReason"]): string {
  if (reason === "asr-correction") {
    return "原文更新";
  }

  if (reason === "translation-correction") {
    return "译文优化";
  }

  return "初始版本";
}

function getTtsStatusLabel(status: TtsSessionState["status"]): string {
  if (status === "speaking") {
    return "播报中";
  }

  if (status === "queued") {
    return "排队中";
  }

  if (status === "paused") {
    return "已暂停";
  }

  if (status === "error") {
    return "异常";
  }

  if (status === "idle") {
    return "待播报";
  }

  return "已关闭";
}

function getNativeAudioCapabilityLabel(capability: NativeSystemAudioCapability | null): string {
  if (!capability) {
    return "检测中";
  }

  if (capability.status === "available") {
    return "WASAPI 可用";
  }

  if (capability.status === "unsupported-platform") {
    return "平台未支持";
  }

  return "Helper 未安装";
}

function getVolumeFromSamples(samples: Uint8Array): number {
  let sum = 0;
  for (const sample of samples) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }

  return Math.min(1, Math.sqrt(sum / samples.length) * 3);
}

function getAnalyserSnapshot(analyser: AnalyserNode): { samples: Uint8Array; volume: number } {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);

  return {
    samples,
    volume: getVolumeFromSamples(samples)
  };
}

function supportsSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function isFloatingCaptionWindow(): boolean {
  return new URLSearchParams(window.location.search).get("window") === "floating";
}

function splitTranscriptIntoSegments(text: string): string[] {
  const segments = text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > 0) {
    return segments.slice(0, 8);
  }

  return text.trim() ? [text.trim()] : [];
}

function FloatingCaptionWindow() {
  const appInfo = window.simultaneousInterpretation;
  const [caption, setCaption] = useState<FloatingCaptionState>(defaultFloatingCaptionState);

  useEffect(() => {
    return appInfo?.onFloatingCaptionUpdate?.((state) => setCaption(state));
  }, [appInfo]);

  return (
    <main className={`floating-caption-shell ${caption.revised ? "floating-revised" : ""}`}>
      <div className="floating-caption-top">
        <span>{caption.statusLabel}</span>
        <span>{caption.languageDirection}</span>
      </div>
      <p className="floating-source">{caption.sourceText}</p>
      <p className="floating-translation">{caption.translatedText}</p>
      <div className="floating-caption-bottom">
        <span>{caption.sessionStatus}</span>
        <span>{caption.latencyLabel}</span>
      </div>
    </main>
  );
}

function createDesktopConstraints(sourceId: string): MediaTrackConstraints {
  return {
    mandatory: {
      chromeMediaSource: "desktop",
      chromeMediaSourceId: sourceId
    }
  } as unknown as MediaTrackConstraints;
}

export function App() {
  const appInfo = window.simultaneousInterpretation;

  if (isFloatingCaptionWindow()) {
    return <FloatingCaptionWindow />;
  }

  const [session, setSession] = useState<AudioSessionState>(initialSession);
  const [activeLanguagePair, setActiveLanguagePair] = useState(loadPreferredLanguagePair);
  const [recentChunks, setRecentChunks] = useState<NormalizedAudioChunk[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [desktopSources, setDesktopSources] = useState<DesktopAudioSource[]>([]);
  const [selectedDesktopSourceId, setSelectedDesktopSourceId] = useState("");
  const [asrEvents, setAsrEvents] = useState<AsrEvent[]>([]);
  const [asrSegments, setAsrSegments] = useState<AsrSegment[]>([]);
  const [translationEvents, setTranslationEvents] = useState<TranslationEvent[]>([]);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [floatingCaptionVisible, setFloatingCaptionVisible] = useState(false);
  const [floatingLayout, setFloatingLayout] = useState<FloatingCaptionLayout>("standard");
  const [floatingPosition, setFloatingPosition] =
    useState<FloatingCaptionPosition>("bottom-right");
  const [ttsSession, setTtsSession] = useState<TtsSessionState>(initialTtsSession);
  const [aiRuntimeConfig, setAiRuntimeConfig] = useState<AiRuntimeConfig | null>(null);
  const [nativeAudioCapability, setNativeAudioCapability] =
    useState<NativeSystemAudioCapability | null>(null);

  const chunkSequenceRef = useRef(0);
  const payloadQueueRef = useRef<NormalizedAudioChunk[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const languagePairRef = useRef(activeLanguagePair);
  const asrClientRef = useRef(createStreamingAsrClient(loadAsrConfig()));
  const translationClientRef = useRef(createTranslationClient());
  const subtitleSegmentsRef = useRef<SubtitleSegment[]>([]);
  const ttsSessionRef = useRef<TtsSessionState>(initialTtsSession);

  const selectedSource = useMemo(
    () => sourceOptions.find((option) => option.type === session.sourceType) ?? sourceOptions[0],
    [session.sourceType]
  );

  const selectedMicrophoneLabel =
    microphoneDevices.find((device) => device.deviceId === selectedMicrophoneId)?.label ??
    "默认麦克风";

  const selectedDesktopSourceName =
    desktopSources.find((source) => source.id === selectedDesktopSourceId)?.name ?? "默认桌面源";

  const latestAsrSegment = asrSegments[0];
  const latestAsrEvent = asrEvents[0];
  const latestSubtitleSegment = subtitleSegments[0];
  const latestTranslationEvent = translationEvents[0];
  const asrConfig = asrClientRef.current.getConfig();

  const floatingCaptionState = useMemo<FloatingCaptionState>(
    () => ({
      translatedText:
        latestSubtitleSegment?.translatedText ??
        (latestAsrSegment ? "正在等待稳定片段生成译文" : "等待字幕"),
      sourceText: latestSubtitleSegment?.sourceText ?? latestAsrSegment?.text ?? selectedSource.description,
      statusLabel: latestSubtitleSegment
        ? latestSubtitleSegment.revised
          ? "字幕已修订"
          : latestSubtitleSegment.status === "partial"
            ? "临时字幕"
            : "实时字幕"
        : session.status === "streaming"
          ? "识别中"
          : "等待输入",
      languageDirection: activeLanguagePair.label,
      sessionStatus: session.status,
      latencyLabel: latestSubtitleSegment
        ? `${latestSubtitleSegment.totalLatencyMs} ms`
        : latestAsrEvent
          ? `${latestAsrEvent.latencyMs} ms`
          : "等待字幕",
      revised: Boolean(latestSubtitleSegment?.revised),
      updatedAtMs: Date.now()
    }),
    [
      activeLanguagePair.label,
      latestAsrEvent,
      latestAsrSegment,
      latestSubtitleSegment,
      selectedSource.description,
      session.status
    ]
  );

  useEffect(() => {
    if (session.status !== "streaming" || session.sourceType !== "file") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const chunk = createSimulatedChunk("file", chunkSequenceRef.current, session.selectedFile);
      chunkSequenceRef.current += 1;
      recordChunk(chunk);
    }, 500);

    return () => window.clearInterval(timer);
  }, [session.selectedFile, session.sourceType, session.status]);

  useEffect(() => {
    return () => {
      cleanupActiveCapture();
    };
  }, []);

  useEffect(() => {
    languagePairRef.current = activeLanguagePair;
    savePreferredLanguagePair(activeLanguagePair.id);
  }, [activeLanguagePair]);

  useEffect(() => {
    appInfo?.updateFloatingCaption?.(floatingCaptionState);
  }, [appInfo, floatingCaptionState]);

  useEffect(() => {
    ttsSessionRef.current = ttsSession;
  }, [ttsSession]);

  useEffect(() => {
    void appInfo?.getAiRuntimeConfig?.().then(setAiRuntimeConfig);
  }, [appInfo]);

  useEffect(() => {
    void appInfo?.getSystemAudioCaptureCapability?.().then(setNativeAudioCapability);
  }, [appInfo]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!latestSubtitleSegment || !ttsSession.enabled) {
      return;
    }

    if (latestSubtitleSegment.status === "partial") {
      return;
    }

    const itemId = `${latestSubtitleSegment.id}-${latestSubtitleSegment.revision}`;
    const alreadySpoken =
      ttsSession.spokenIds.includes(itemId) ||
      ttsSession.queue.some((item) => item.id === itemId) ||
      ttsSession.currentItem?.id === itemId;

    if (alreadySpoken) {
      return;
    }

    setTtsSession((current) => ({
      ...current,
      status: current.status === "disabled" || current.status === "idle" ? "queued" : current.status,
      queue: [
        ...current.queue,
        {
          id: itemId,
          text: latestSubtitleSegment.translatedText,
          languageCode: latestSubtitleSegment.targetLanguage === "中文" ? "zh-CN" : "en-US",
          label: `片段 ${latestSubtitleSegment.id.replace("asr-segment-", "#")}`
        }
      ],
      error: null
    }));
  }, [latestSubtitleSegment, ttsSession]);

  useEffect(() => {
    if (!ttsSession.enabled || ttsSession.status === "speaking" || ttsSession.status === "paused") {
      return;
    }

    const nextItem = ttsSession.queue[0];
    if (!nextItem) {
      if (ttsSession.status !== "idle") {
        setTtsSession((current) => ({
          ...current,
          status: current.enabled ? "idle" : "disabled",
          currentItem: null
        }));
      }
      return;
    }

    playTtsItem(nextItem);
  }, [ttsSession]);

  function updatePayloadQueue(
    chunk: NormalizedAudioChunk,
    currentQueue: AudioChunkQueueState
  ): AudioChunkQueueState {
    if (!chunk.payloadMetadata.available) {
      payloadQueueRef.current = [];
      return {
        ...initialQueueState,
        dropped: currentQueue.dropped,
        lastSequence: chunk.sequence,
        lastPayloadBytes: 0
      };
    }

    const pendingChunks = [...payloadQueueRef.current, chunk];
    const overflow = Math.max(0, pendingChunks.length - AUDIO_PAYLOAD_QUEUE_MAX_DEPTH);
    payloadQueueRef.current = pendingChunks.slice(-AUDIO_PAYLOAD_QUEUE_MAX_DEPTH);

    return {
      maxDepth: AUDIO_PAYLOAD_QUEUE_MAX_DEPTH,
      depth: payloadQueueRef.current.length,
      dropped: currentQueue.dropped + overflow,
      lastSequence: chunk.sequence,
      lastPayloadBytes: chunk.payloadMetadata.byteLength
    };
  }

  function recordChunk(chunk: NormalizedAudioChunk): void {
    setSession((current) => ({
      ...current,
      lastChunk: chunk,
      chunksProduced: current.chunksProduced + 1,
      volume: chunk.volume,
      queue: updatePayloadQueue(chunk, current.queue),
      error: null
    }));
    setRecentChunks((current) => [chunk, ...current].slice(0, 5));
    publishAsrEvents(chunk);
  }

  function publishAsrEvents(chunk: NormalizedAudioChunk): void {
    const nextEvents = asrClientRef.current.pushChunk(chunk, languagePairRef.current);

    if (nextEvents.length === 0) {
      return;
    }

    const nextSegments = nextEvents.map((event) => ({
      id: event.segmentId,
      sourceType: event.sourceType,
      text: event.text,
      status: event.status,
      startedAtMs: event.audioStartMs,
      endedAtMs: event.audioEndMs,
      updatedAtMs: event.receivedAtMs,
      latencyMs: event.latencyMs,
      revision: event.revision
    }));

    setAsrEvents((current) => [...nextEvents, ...current].slice(0, 8));
    setAsrSegments((current) => {
      const byId = new Map(current.map((segment) => [segment.id, segment]));

      nextSegments.forEach((segment) => {
        byId.set(segment.id, segment);
      });

      return Array.from(byId.values())
        .sort((left, right) => right.startedAtMs - left.startedAtMs)
        .slice(0, 6);
    });

    void publishTranslationEvents(nextSegments);
  }

  async function publishTranslationEvents(changedSegments: AsrSegment[]): Promise<void> {
    if (changedSegments.length === 0) {
      return;
    }

    const nextEvents = await Promise.all(
      changedSegments.map((segment) =>
        translationClientRef.current.translate({
        segment,
        languagePair: languagePairRef.current,
        context: subtitleSegmentsRef.current.slice(0, 3).map(
          (item): TranslationContextItem => ({
            segmentId: item.id,
            sourceText: item.sourceText,
            translatedText: item.translatedText
          })
        )
      })
      )
    );

    setTranslationEvents((current) => [...nextEvents, ...current].slice(0, 8));
    setSubtitleSegments((current) => {
      const byId = new Map(current.map((segment) => [segment.id, segment]));

      nextEvents.forEach((event) => {
        const asrSegment = changedSegments.find((segment) => segment.id === event.segmentId);

        if (!asrSegment) {
          return;
        }

        const existing = byId.get(event.segmentId);
        const currentIndex = current.findIndex((segment) => segment.id === event.segmentId);
        const canRevise =
          !existing || (currentIndex >= 0 && currentIndex < RECENT_REVISION_WINDOW);

        if (existing && !canRevise) {
          return;
        }

        const revision = existing ? existing.revision + 1 : event.revision;
        const status = existing
          ? "revised"
          : asrSegment.status === "final"
            ? "final"
            : "partial";

        byId.set(event.segmentId, {
          id: event.segmentId,
          sourceText: event.sourceText,
          translatedText: event.translatedText,
          sourceLanguage: event.sourceLanguage,
          targetLanguage: event.targetLanguage,
          status,
          revision,
          revisionReason: existing ? event.revisionReason : "initial",
          startedAtMs: asrSegment.startedAtMs,
          endedAtMs: asrSegment.endedAtMs,
          updatedAtMs: event.createdAtMs,
          asrLatencyMs: asrSegment.latencyMs,
          translationLatencyMs: event.latencyMs,
          totalLatencyMs: asrSegment.latencyMs + event.latencyMs,
          contextSize: event.contextSize,
          revised: Boolean(existing)
        });
      });

      const nextSegments = Array.from(byId.values())
        .sort((left, right) => right.startedAtMs - left.startedAtMs)
        .slice(0, 6);
      subtitleSegmentsRef.current = nextSegments;
      return nextSegments;
    });
  }

  function publishProviderTranscript(text: string, latencyMs: number): void {
    const segments = splitTranscriptIntoSegments(text);

    if (segments.length === 0) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "真实转写结果为空。"
      }));
      return;
    }

    segments.forEach((segmentText, index) => {
      window.setTimeout(() => {
        const segmentId = `provider-segment-${index + 1}`;
        const now = Date.now();
        const asrEvent: AsrEvent = {
          id: `${segmentId}-final`,
          segmentId,
          chunkId: `provider-file-${index + 1}`,
          sourceType: "file",
          sequence: index,
          audioStartMs: index * PROVIDER_TRANSCRIPT_SEGMENT_MS,
          audioEndMs: (index + 1) * PROVIDER_TRANSCRIPT_SEGMENT_MS,
          text: segmentText,
          status: "final",
          revision: 1,
          receivedAtMs: now,
          latencyMs: index === 0 ? latencyMs : 180
        };
        const asrSegment: AsrSegment = {
          id: segmentId,
          sourceType: "file",
          text: segmentText,
          status: "final",
          startedAtMs: asrEvent.audioStartMs,
          endedAtMs: asrEvent.audioEndMs,
          updatedAtMs: now,
          latencyMs: asrEvent.latencyMs,
          revision: 1
        };

        setAsrEvents((current) => [asrEvent, ...current].slice(0, 8));
        setAsrSegments((current) => [asrSegment, ...current].slice(0, 6));
        setSession((current) => ({
          ...current,
          chunksProduced: current.chunksProduced + 1,
          lastChunk: {
            id: asrEvent.chunkId,
            sourceType: "file",
            sequence: index,
            timestampMs: asrEvent.audioStartMs,
            durationMs: PROVIDER_TRANSCRIPT_SEGMENT_MS,
            sampleRate: 16000,
            channels: 1,
            volume: 0.72,
            status: "captured",
            fileName: current.selectedFile?.name,
            payloadMetadata: createEmptyPayloadMetadata()
          },
          volume: 0.72,
          error: null
        }));
        void publishTranslationEvents([asrSegment]);
      }, index * 700);
    });
  }

  function resetAsrState(): void {
    asrClientRef.current.reset();
    setAsrEvents([]);
    setAsrSegments([]);
    setTranslationEvents([]);
    setSubtitleSegments([]);
    subtitleSegmentsRef.current = [];
    clearTtsQueue();
  }

  function updateLanguagePair(pairId: string): void {
    const nextPair = getLanguagePair(pairId);
    setActiveLanguagePair(nextPair);
    resetAsrState();
  }

  function resetInputState(type: AudioSourceType): void {
    chunkSequenceRef.current = 0;
    payloadQueueRef.current = [];
    setRecentChunks([]);
    resetAsrState();
    setSession((current) => ({
      ...current,
      sourceType: type,
      status: type === "file" && current.selectedFile ? "ready" : "idle",
      lastChunk: null,
      chunksProduced: 0,
      volume: 0,
      queue: initialQueueState,
      error: null
    }));
  }

  function cleanupActiveCapture(): void {
    if (captureTimerRef.current !== null) {
      window.clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    payloadQueueRef.current = [];

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function updateSourceType(type: AudioSourceType): void {
    cleanupActiveCapture();
    resetInputState(type);

    if (type === "microphone" && microphoneDevices.length === 0) {
      void refreshMicrophoneDevices();
    }

    if (type === "system" && desktopSources.length === 0) {
      void refreshDesktopAudioSources();
    }
  }

  async function refreshDesktopAudioSources(): Promise<void> {
    if (!appInfo?.listDesktopAudioSources) {
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        error: "当前运行环境无法枚举桌面音频源。"
      }));
      return;
    }

    try {
      const sources = await appInfo.listDesktopAudioSources();
      setDesktopSources(sources);
      setSelectedDesktopSourceId((current) => current || sources[0]?.id || "");
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: sources.length > 0 ? "ready" : "error",
        error: sources.length > 0 ? null : "没有发现可用的桌面或窗口来源。"
      }));
    } catch (error) {
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        error: error instanceof Error ? error.message : "桌面音频源枚举失败。"
      }));
    }
  }

  async function refreshMicrophoneDevices(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "当前运行环境不支持麦克风设备枚举。"
      }));
      return;
    }

    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionStream.getTracks().forEach((track) => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter((device) => device.kind === "audioinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `麦克风 ${index + 1}`
        }));

      setMicrophoneDevices(audioInputs);
      setSelectedMicrophoneId((current) => current || audioInputs[0]?.deviceId || "");
      setSession((current) => ({
        ...current,
        sourceType: "microphone",
        status: audioInputs.length > 0 ? "ready" : "error",
        error: audioInputs.length > 0 ? null : "没有发现可用的麦克风设备。"
      }));
    } catch (error) {
      setSession((current) => ({
        ...current,
        sourceType: "microphone",
        status: "error",
        error: error instanceof Error ? error.message : "麦克风权限获取失败。"
      }));
    }
  }

  function startAnalyserCapture(
    stream: MediaStream,
    sourceType: "system" | "microphone",
    sourceLabel: string
  ): void {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;

    payloadQueueRef.current = [];
    setSession((current) => ({
      ...current,
      sourceType,
      status: "streaming",
      lastChunk: null,
      chunksProduced: 0,
      volume: 0,
      queue: initialQueueState,
      error: null
    }));

    captureTimerRef.current = window.setInterval(() => {
      const snapshot = getAnalyserSnapshot(analyser);
      const payload = createPcm16PayloadFromTimeDomainSamples(
        snapshot.samples,
        audioContext.sampleRate,
        1,
        500
      );
      const chunk =
        sourceType === "microphone"
          ? createCapturedMicrophoneChunk(chunkSequenceRef.current, snapshot.volume, sourceLabel, payload)
          : createCapturedSystemAudioChunk(chunkSequenceRef.current, snapshot.volume, sourceLabel, payload);
      chunkSequenceRef.current += 1;
      recordChunk(chunk);
    }, 500);
  }

  async function startMicrophoneCapture(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "当前运行环境不支持麦克风采集。"
      }));
      return;
    }

    try {
      cleanupActiveCapture();
      chunkSequenceRef.current = 0;
      setRecentChunks([]);
      resetAsrState();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMicrophoneId
          ? {
              deviceId: { exact: selectedMicrophoneId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      });

      startAnalyserCapture(stream, "microphone", selectedMicrophoneLabel);
    } catch (error) {
      cleanupActiveCapture();
      setSession((current) => ({
        ...current,
        sourceType: "microphone",
        status: "error",
        volume: 0,
        error: error instanceof Error ? error.message : "麦克风启动失败。"
      }));
    }
  }

  async function startSystemAudioCapture(): Promise<void> {
    const sourceId = selectedDesktopSourceId || desktopSources[0]?.id;
    if (!sourceId) {
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        error: "请先刷新并选择一个桌面或窗口来源。"
      }));
      return;
    }

    try {
      cleanupActiveCapture();
      chunkSequenceRef.current = 0;
      setRecentChunks([]);
      resetAsrState();

      const desktopConstraints = createDesktopConstraints(sourceId);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: desktopConstraints,
        video: desktopConstraints
      });

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("当前桌面源没有提供可捕获的系统音频。");
      }

      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      startAnalyserCapture(stream, "system", selectedDesktopSourceName);
    } catch (error) {
      cleanupActiveCapture();
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        volume: 0,
        error:
          error instanceof Error
            ? error.message
            : "系统音频采集失败，请确认平台权限和来源是否支持音频。"
      }));
    }
  }

  async function selectLocalFile(): Promise<void> {
    cleanupActiveCapture();

    if (!appInfo?.selectLocalMediaFile) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "当前运行环境无法打开本地文件选择器。"
      }));
      return;
    }

    const file = (await appInfo.selectLocalMediaFile()) as LocalMediaFile | null;

    if (!file) {
      return;
    }

    chunkSequenceRef.current = 0;
    payloadQueueRef.current = [];
    setRecentChunks([]);
    resetAsrState();
    setSession((current) => ({
      ...current,
      sourceType: "file",
      status: "ready",
      selectedFile: file,
      lastChunk: null,
      chunksProduced: 0,
      volume: 0,
      queue: initialQueueState,
      error: null
    }));
  }

  async function startSession(): Promise<void> {
    if (
      session.sourceType === "file" &&
      asrConfig.provider === "openai" &&
      asrConfig.mode === "provider"
    ) {
      await startProviderFileTranscription();
      return;
    }

    if (session.sourceType === "system") {
      await startSystemAudioCapture();
      return;
    }

    if (session.sourceType === "microphone") {
      await startMicrophoneCapture();
      return;
    }

    cleanupActiveCapture();

    if (!session.selectedFile) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "请先选择一个本地音频或视频文件。"
      }));
      return;
    }

    setSession((current) => ({
      ...current,
      status: "streaming",
      error: null
    }));
  }

  async function startProviderFileTranscription(): Promise<void> {
    cleanupActiveCapture();

    if (!session.selectedFile) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "请先选择一个本地音频或视频文件。"
      }));
      return;
    }

    if (!appInfo?.transcribeLocalMediaFile) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "当前运行环境无法调用真实转写服务。"
      }));
      return;
    }

    if (aiRuntimeConfig && !aiRuntimeConfig.hasOpenAiKey) {
      setSession((current) => ({
        ...current,
        status: "error",
        error: "请先在 .env 中配置 OPENAI_API_KEY，然后重启应用。"
      }));
      return;
    }

    resetAsrState();
    payloadQueueRef.current = [];
    setSession((current) => ({
      ...current,
      status: "streaming",
      error: null,
      chunksProduced: 0,
      volume: 0,
      queue: initialQueueState
    }));

    try {
      const response = await appInfo.transcribeLocalMediaFile({
        filePath: session.selectedFile.path,
        languageCode: activeLanguagePair.source.code,
        model: asrConfig.model
      });
      publishProviderTranscript(response.text, response.latencyMs);
    } catch (error) {
      setSession((current) => ({
        ...current,
        status: "error",
        volume: 0,
        error: error instanceof Error ? error.message : "真实转写服务调用失败。"
      }));
    }
  }

  function pauseSession(): void {
    if (session.sourceType === "microphone" || session.sourceType === "system") {
      cleanupActiveCapture();
    }

    setSession((current) => ({
      ...current,
      status: current.status === "streaming" ? "paused" : current.status,
      volume: current.status === "streaming" ? 0 : current.volume
    }));
  }

  function setTtsEnabled(enabled: boolean): void {
    if (enabled && !supportsSpeechSynthesis()) {
      setTtsSession((current) => ({
        ...current,
        enabled: false,
        status: "error",
        error: "当前运行环境不支持语音播报。"
      }));
      return;
    }

    if (!enabled) {
      window.speechSynthesis?.cancel();
      setTtsSession((current) => ({
        ...current,
        enabled: false,
        status: "disabled",
        queue: [],
        currentItem: null,
        error: null
      }));
      return;
    }

    setTtsSession((current) => ({
      ...current,
      enabled: true,
      status: current.queue.length > 0 ? "queued" : "idle",
      error: null
    }));
  }

  function playTtsItem(item: TtsQueueItem): void {
    if (!supportsSpeechSynthesis()) {
      setTtsSession((current) => ({
        ...current,
        status: "error",
        error: "当前运行环境不支持语音播报。"
      }));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = item.languageCode;
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      setTtsSession((current) => ({
        ...current,
        status: current.queue.length > 1 ? "queued" : "idle",
        queue: current.queue.filter((queuedItem) => queuedItem.id !== item.id),
        currentItem: null,
        spokenIds: [...current.spokenIds, item.id].slice(-24),
        error: null
      }));
    };

    utterance.onerror = () => {
      setTtsSession((current) => ({
        ...current,
        status: "error",
        queue: current.queue.filter((queuedItem) => queuedItem.id !== item.id),
        currentItem: null,
        error: "语音播报失败，请稍后重试。"
      }));
    };

    setTtsSession((current) => ({
      ...current,
      status: "speaking",
      currentItem: item,
      queue: current.queue.filter((queuedItem) => queuedItem.id !== item.id),
      error: null
    }));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function pauseTts(): void {
    if (ttsSession.status === "speaking") {
      window.speechSynthesis?.pause();
      setTtsSession((current) => ({
        ...current,
        status: "paused"
      }));
      return;
    }

    if (ttsSession.status === "paused") {
      window.speechSynthesis?.resume();
      setTtsSession((current) => ({
        ...current,
        status: current.currentItem ? "speaking" : "queued"
      }));
    }
  }

  function clearTtsQueue(): void {
    window.speechSynthesis?.cancel();
    setTtsSession((current) => ({
      ...current,
      status: current.enabled ? "idle" : "disabled",
      queue: [],
      currentItem: null,
      error: null
    }));
  }

  async function openFloatingCaption(): Promise<void> {
    if (!appInfo?.openFloatingCaption) {
      setSession((current) => ({
        ...current,
        error: "当前运行环境无法打开悬浮字幕窗口。"
      }));
      return;
    }

    const result = await appInfo.openFloatingCaption({
      layout: floatingLayout,
      position: floatingPosition
    });
    setFloatingCaptionVisible(result.visible);
    appInfo.updateFloatingCaption?.(floatingCaptionState);
  }

  async function closeFloatingCaption(): Promise<void> {
    const result = await appInfo?.closeFloatingCaption?.();
    setFloatingCaptionVisible(Boolean(result?.visible));
  }

  function updateFloatingLayout(layout: FloatingCaptionLayout): void {
    setFloatingLayout(layout);
    if (floatingCaptionVisible) {
      void appInfo?.configureFloatingCaption?.({
        layout,
        position: floatingPosition
      });
    }
  }

  function updateFloatingPosition(position: FloatingCaptionPosition): void {
    setFloatingPosition(position);
    if (floatingCaptionVisible) {
      void appInfo?.configureFloatingCaption?.({
        layout: floatingLayout,
        position
      });
    }
  }

  const metrics = [
    { label: "音频源", value: getSourceLabel(session.sourceType) },
    { label: "输入状态", value: session.status },
    { label: "音频块", value: String(session.chunksProduced) },
    { label: "ASR", value: `${asrConfig.provider}/${asrConfig.model}` },
    {
      label: "API Key",
      value:
        aiRuntimeConfig?.provider === "openai"
          ? aiRuntimeConfig.hasOpenAiKey
            ? "已配置"
            : "未配置"
          : "模拟"
    },
    {
      label: "字幕延迟",
      value: latestSubtitleSegment
        ? `${latestSubtitleSegment.totalLatencyMs} ms`
        : latestAsrEvent
          ? `${latestAsrEvent.latencyMs} ms`
          : "等待字幕"
    },
    { label: "音量", value: `${Math.round(session.volume * 100)}%` },
    { label: "系统捕获", value: getNativeAudioCapabilityLabel(nativeAudioCapability) },
    {
      label: "Payload",
      value: session.lastChunk?.payloadMetadata.available
        ? `${session.lastChunk.payloadMetadata.sampleFormat}/${session.lastChunk.payloadMetadata.byteLength} B`
        : "metadata-only"
    },
    {
      label: "队列",
      value: `${session.queue.depth}/${session.queue.maxDepth} · 丢弃 ${session.queue.dropped}`
    },
    { label: "修订窗口", value: `${RECENT_REVISION_WINDOW} 条` },
    { label: "悬浮窗", value: floatingCaptionVisible ? "已打开" : "未打开" },
    { label: "语音播报", value: getTtsStatusLabel(ttsSession.status) },
    { label: "语言方向", value: activeLanguagePair.label }
  ];

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <header className="top-bar" aria-label="同声传译控制区">
        <div className="brand-block">
          <p className="eyebrow">桌面 AI 同传助手</p>
          <h1 id="app-title">声桥 LinguaBridge</h1>
        </div>

        <form className="control-cluster" aria-label="会话配置">
          <label>
            <span>音频源</span>
            <select
              value={session.sourceType}
              aria-label="选择音频源"
              onChange={(event) => updateSourceType(event.target.value as AudioSourceType)}
            >
              {sourceOptions.map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>语言方向</span>
            <select
              value={activeLanguagePair.id}
              aria-label="选择语言方向"
              onChange={(event) => updateLanguagePair(event.target.value)}
            >
              {supportedLanguagePairs.map((pair) => (
                <option key={pair.id} value={pair.id}>
                  {pair.label}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="primary-action" onClick={() => void startSession()}>
            开始
          </button>
          <button type="button" className="secondary-action" onClick={pauseSession}>
            暂停
          </button>
        </form>
      </header>

      <section className="workspace-grid" aria-label="同传工作台">
        <section className="live-panel" aria-labelledby="live-caption-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">实时输入</p>
              <h2 id="live-caption-title">{selectedSource.label}</h2>
            </div>
            <span className={`status-pill status-${session.status}`}>
              {session.status === "streaming" ? "输入中" : "等待输入"}
            </span>
          </div>

          <div className="caption-stage" aria-live="polite">
            <p className="source-caption">
              {latestSubtitleSegment
                ? latestSubtitleSegment.sourceText
                : latestAsrSegment
                  ? latestAsrSegment.text
                : selectedSource.description}
            </p>
            <p
              className={`translated-caption ${
                latestSubtitleSegment?.revised ? "caption-revised" : ""
              }`}
            >
              {latestSubtitleSegment
                ? latestSubtitleSegment.translatedText
                : latestAsrSegment
                  ? "正在等待稳定片段生成译文"
                : session.sourceType === "system"
                  ? `当前来源：${selectedDesktopSourceName}`
                  : session.sourceType === "microphone"
                    ? `当前设备：${selectedMicrophoneLabel}`
                    : session.selectedFile
                      ? `已选择 ${session.selectedFile.name}`
                      : "选择音频源后，可先用文件模拟、麦克风或系统音频验证实时输入链路。"}
            </p>
            {latestSubtitleSegment || latestAsrSegment ? (
              <div className="asr-detail-row" aria-label="识别事件状态">
                <span>
                  {latestSubtitleSegment
                    ? latestSubtitleSegment.status === "partial"
                      ? "Partial"
                      : latestSubtitleSegment.revised
                        ? "已修订"
                        : "Translated"
                    : "ASR"}
                </span>
                <span>
                  {latestSubtitleSegment
                    ? `${latestSubtitleSegment.sourceLanguage} -> ${latestSubtitleSegment.targetLanguage}`
                    : latestAsrSegment?.status === "final"
                      ? "Final"
                      : "Partial"}
                </span>
                <span>
                  片段{" "}
                  {(latestSubtitleSegment?.id ?? latestAsrSegment?.id ?? "").replace(
                    "asr-segment-",
                    "#"
                  )}
                </span>
                <span>
                  {latestSubtitleSegment
                    ? `版本 ${latestSubtitleSegment.revision}`
                    : `${latestAsrSegment?.latencyMs ?? 0} ms`}
                </span>
                {latestSubtitleSegment ? (
                  <span>{latestSubtitleSegment.totalLatencyMs} ms</span>
                ) : null}
              </div>
            ) : null}
            {session.error ? <p className="error-message">{session.error}</p> : null}
          </div>

          <div className="source-actions" aria-label="音频源操作">
            {session.sourceType === "system" ? (
              <>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void refreshDesktopAudioSources()}
                >
                  刷新来源
                </button>
                <select
                  className="inline-select"
                  value={selectedDesktopSourceId}
                  aria-label="选择桌面或窗口来源"
                  onChange={(event) => setSelectedDesktopSourceId(event.target.value)}
                >
                  {desktopSources.length === 0 ? (
                    <option value="">默认桌面源</option>
                  ) : (
                    desktopSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name}
                      </option>
                    ))
                  )}
                </select>
              </>
            ) : session.sourceType === "microphone" ? (
              <>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void refreshMicrophoneDevices()}
                >
                  刷新麦克风
                </button>
                <select
                  className="inline-select"
                  value={selectedMicrophoneId}
                  aria-label="选择麦克风设备"
                  onChange={(event) => setSelectedMicrophoneId(event.target.value)}
                >
                  {microphoneDevices.length === 0 ? (
                    <option value="">默认麦克风</option>
                  ) : (
                    microphoneDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))
                  )}
                </select>
              </>
            ) : (
              <button type="button" className="secondary-action" onClick={selectLocalFile}>
                选择本地文件
              </button>
            )}
            <div className="volume-meter" aria-label="音量活动">
              <span style={{ width: `${Math.round(session.volume * 100)}%` }} />
            </div>
          </div>

          {session.sourceType === "system" && nativeAudioCapability ? (
            <div
              className={`capture-capability capture-${nativeAudioCapability.status}`}
              aria-label="系统音频捕获能力"
            >
              <div>
                <span>{getNativeAudioCapabilityLabel(nativeAudioCapability)}</span>
                <strong>{nativeAudioCapability.strategy}</strong>
              </div>
              <p>{nativeAudioCapability.notes[0]}</p>
              <p>
                fallback: {nativeAudioCapability.fallback} · {nativeAudioCapability.sampleRate} Hz ·{" "}
                {nativeAudioCapability.chunkDurationMs} ms
              </p>
              <p>{nativeAudioCapability.nextStep}</p>
            </div>
          ) : null}

          <div className="floating-controls" aria-label="悬浮字幕控制">
            <button
              type="button"
              className="secondary-action"
              onClick={() => void openFloatingCaption()}
            >
              打开悬浮字幕
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => void closeFloatingCaption()}
            >
              关闭悬浮字幕
            </button>
            <select
              className="inline-select"
              value={floatingLayout}
              aria-label="悬浮字幕尺寸"
              onChange={(event) => updateFloatingLayout(event.target.value as FloatingCaptionLayout)}
            >
              <option value="compact">紧凑</option>
              <option value="standard">标准</option>
              <option value="wide">宽屏</option>
            </select>
            <select
              className="inline-select"
              value={floatingPosition}
              aria-label="悬浮字幕位置"
              onChange={(event) =>
                updateFloatingPosition(event.target.value as FloatingCaptionPosition)
              }
            >
              <option value="top-left">左上</option>
              <option value="top-right">右上</option>
              <option value="bottom-left">左下</option>
              <option value="bottom-right">右下</option>
            </select>
          </div>

          <div className="tts-controls" aria-label="语音播报控制">
            <label className="tts-toggle">
              <input
                type="checkbox"
                checked={ttsSession.enabled}
                onChange={(event) => setTtsEnabled(event.target.checked)}
              />
              <span>译文播报</span>
            </label>
            <button type="button" className="secondary-action" onClick={pauseTts}>
              {ttsSession.status === "paused" ? "继续播报" : "暂停播报"}
            </button>
            <button type="button" className="secondary-action" onClick={clearTtsQueue}>
              停止播报
            </button>
            <div className={`tts-status tts-${ttsSession.status}`}>
              <span>{getTtsStatusLabel(ttsSession.status)}</span>
              <strong>
                {ttsSession.currentItem?.label ??
                  (ttsSession.queue.length > 0
                    ? `队列 ${ttsSession.queue.length} 条`
                    : "暂无队列")}
              </strong>
            </div>
          </div>
          {ttsSession.error ? <p className="error-message">{ttsSession.error}</p> : null}

          <div className="placeholder-row" aria-label="输入源状态">
            <span>
              {session.lastChunk?.payloadMetadata.available
                ? `Payload：${session.lastChunk.payloadMetadata.sampleFormat} · ${session.lastChunk.payloadMetadata.frameCount} frames`
                : "统一音频块：16 kHz / mono / 500 ms"}
            </span>
            <span>
              {session.sourceType === "system"
                ? selectedDesktopSourceName
                : session.sourceType === "microphone"
                  ? selectedMicrophoneLabel
                  : session.selectedFile
                    ? `${session.selectedFile.extension.toUpperCase()} · ${formatFileSize(
                        session.selectedFile.size
                      )}`
                    : "尚未选择文件"}
            </span>
            <span>
              {session.lastChunk
                ? `最近时间戳 ${formatTimestamp(session.lastChunk.timestampMs)} · ${
                    session.lastChunk.payloadMetadata.providerReady ? "provider-ready" : "metadata-only"
                  }`
                : "等待首个音频块"}
            </span>
          </div>
        </section>

        <aside className="history-panel" aria-labelledby="history-title">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Chunks</p>
              <h2 id="history-title">字幕记录</h2>
            </div>
            <span className="small-version">v{appInfo?.version ?? "0.1.0"}</span>
          </div>

          <div className="history-list">
            {subtitleSegments.length === 0 ? (
              <article className="history-item">
                <div className="history-meta">
                  <time>--:--</time>
                  <span>等待</span>
                </div>
                <p className="history-source">暂无译文字幕</p>
                <p className="history-translation">
                  稳定原文片段生成后，这里会显示双语字幕和翻译延迟。
                </p>
              </article>
            ) : (
              subtitleSegments.map((segment) => (
                <article
                  className={`history-item ${segment.revised ? "history-item-revised" : ""}`}
                  key={segment.id}
                >
                  <div className="history-meta">
                    <time>{formatTimestamp(segment.startedAtMs)}</time>
                    <span>
                      {segment.revised
                        ? "已修订"
                        : segment.status === "partial"
                          ? "临时字幕"
                          : `${segment.sourceLanguage} -> ${segment.targetLanguage}`}
                    </span>
                  </div>
                  <p className="history-source">{segment.sourceText}</p>
                  <p className="history-translation">
                    {segment.translatedText}
                  </p>
                  <p className="history-footnote">
                    版本 {segment.revision} · {getRevisionReasonLabel(segment.revisionReason)} ·
                    上下文 {segment.contextSize} · 延迟 {segment.totalLatencyMs} ms
                  </p>
                </article>
              ))
            )}
          </div>
        </aside>
      </section>

      <footer className="status-strip" aria-label="系统状态">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </footer>
    </main>
  );
}
