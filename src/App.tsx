import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Download,
  History,
  MonitorUp,
  Settings,
  Trash2,
  X
} from "lucide-react";
import {
  createCapturedMicrophoneChunk,
  createCapturedSystemAudioChunk,
  createEmptyPayloadMetadata,
  createPcm16PayloadFromFloatSamples,
  createPcm16PayloadFromTimeDomainSamples,
  createSimulatedChunk,
  formatTimestamp
} from "./audio/simulator";
import { createStreamingAsrClient } from "./asr/client";
import { loadAsrConfig } from "./asr/config";
import { RealtimeAsrEventDeduplicator } from "./asr/eventDeduplication";
import type { AsrEvent, AsrSegment } from "./asr/types";
import {
  getLanguagePair,
  loadPreferredLanguagePair,
  savePreferredLanguagePair,
  supportedLanguagePairs
} from "./language/pairs";
import { createLiveExperienceState } from "./liveExperience/state";
import { loadRealtimeLatencyTuning } from "./realtime/tuning";
import { createRealtimeDiagnosticsSnapshot, type RealtimeDiagnosticsSnapshot } from "./realtime/diagnostics";
import { SessionLatencyAggregator } from "./realtime/latency";
import {
  ProviderLatencyReferenceRunner,
  type ReferenceLatencyReport
} from "./verification/realtimeLatencyReport";
import {
  emptyCaptionCueSnapshot,
  updateCaptionCueSnapshot,
  type CaptionCueSnapshot
} from "./captions/cue";
import {
  DEFAULT_REVISION_WINDOW,
  getSubtitleContextItems,
  reconcileSubtitleSegments
} from "./subtitles/reconciliation";
import { createTranslationClient } from "./translation/client";
import { createSubtitleRefinementClient } from "./translation/refinementClient";
import { createSubtitleRefinementScheduler } from "./translation/refinementScheduler";
import { createLowLatencyTranslationScheduler } from "./translation/scheduler";
import type { SubtitleRefinementEvent, SubtitleSegment, TranslationEvent } from "./translation/types";
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
import { OrderedAudioPayloadQueue } from "./audio/payloadQueue";
import { createDeferredHistoryWriter, type DeferredHistoryWriter } from "./history/deferredWriter";
import { groupHistoryRecords } from "./history/grouping";
import { toHistoryRecords } from "./history/projection";
import {
  clearHistory,
  loadHistory,
  saveHistory,
  serializeHistoryText,
  upsertHistoryRecords
} from "./history/storage";
import type { HistoryRecord } from "./history/types";
import {
  parseUiFontSize,
  parseUiTheme,
  UI_FONT_SIZE_KEY,
  UI_THEME_KEY,
  type UiFontSize,
  type UiTheme
} from "./ui/preferences";

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

const RECENT_REVISION_WINDOW = DEFAULT_REVISION_WINDOW;
const PROVIDER_TRANSCRIPT_SEGMENT_MS = 2800;
const realtimeLatencyTuning = loadRealtimeLatencyTuning();

const defaultFloatingCaptionState: FloatingCaptionState = {
  translatedText: "等待字幕",
  sourceText: "开始输入后，这里会显示实时字幕。",
  previousText: null,
  statusLabel: "等待输入",
  compactStatusLabel: "等待",
  severity: "neutral",
  languageDirection: "英语 -> 中文",
  sessionStatus: "idle",
  latencyLabel: "等待字幕",
  revised: false,
  locked: false,
  mousePassthrough: false,
  opacity: 0.92,
  fontScale: 1,
  controlsVisible: true,
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

function getVolumeFromFloatSamples(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let sum = 0;
  samples.forEach((sample) => {
    sum += sample * sample;
  });

  return Math.min(1, Math.sqrt(sum / samples.length) * 3);
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

function createCaptureSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadUiTheme(): UiTheme {
  try {
    return parseUiTheme(window.localStorage.getItem(UI_THEME_KEY));
  } catch {
    return "system";
  }
}

function loadUiFontSize(): UiFontSize {
  try {
    return parseUiFontSize(window.localStorage.getItem(UI_FONT_SIZE_KEY));
  } catch {
    return "medium";
  }
}

function FloatingCaptionWindow() {
  const appInfo = window.simultaneousInterpretation;
  const [caption, setCaption] = useState<FloatingCaptionState>(defaultFloatingCaptionState);
  const [localLocked, setLocalLocked] = useState(defaultFloatingCaptionState.locked);
  const [localMousePassthrough, setLocalMousePassthrough] = useState(
    defaultFloatingCaptionState.mousePassthrough
  );
  const [localOpacity, setLocalOpacity] = useState(defaultFloatingCaptionState.opacity);
  const [localFontScale, setLocalFontScale] = useState(defaultFloatingCaptionState.fontScale);

  useEffect(() => {
    return appInfo?.onFloatingCaptionUpdate?.((state) => {
      setCaption(state);
      setLocalLocked(state.locked);
      setLocalMousePassthrough(state.mousePassthrough);
      setLocalOpacity(state.opacity);
      setLocalFontScale(state.fontScale);
    });
  }, [appInfo]);

  function publishLocalCaption(next: Partial<FloatingCaptionState>): void {
    const nextState = {
      ...caption,
      locked: localLocked,
      mousePassthrough: localMousePassthrough,
      opacity: localOpacity,
      fontScale: localFontScale,
      ...next,
      updatedAtMs: Date.now()
    };
    setCaption(nextState);
    appInfo?.updateFloatingCaption?.(nextState);
  }

  function toggleLocked(): void {
    const nextLocked = !localLocked;
    const nextPassthrough = nextLocked ? true : false;
    setLocalLocked(nextLocked);
    setLocalMousePassthrough(nextPassthrough);
    void appInfo?.setFloatingCaptionInteraction?.({
      locked: nextLocked,
      mousePassthrough: nextPassthrough
    });
    publishLocalCaption({
      locked: nextLocked,
      mousePassthrough: nextPassthrough
    });
  }

  function updateOpacity(nextOpacity: number): void {
    setLocalOpacity(nextOpacity);
    publishLocalCaption({ opacity: nextOpacity });
  }

  function updateFontScale(nextScale: number): void {
    setLocalFontScale(nextScale);
    publishLocalCaption({ fontScale: nextScale });
  }

  return (
    <main
      className={`floating-caption-shell floating-${caption.severity} ${
        caption.revised ? "floating-revised" : ""
      } ${localLocked ? "floating-locked" : ""}`}
      style={
        {
          "--floating-opacity": localOpacity,
          "--floating-font-scale": localFontScale
        } as React.CSSProperties
      }
    >
      <div className="floating-controls" aria-label="悬浮字幕控制">
        <button type="button" onClick={toggleLocked}>
          {localLocked ? "解锁" : "锁定"}
        </button>
        <button type="button" onClick={() => updateFontScale(Math.max(0.82, localFontScale - 0.08))}>
          A-
        </button>
        <button type="button" onClick={() => updateFontScale(Math.min(1.28, localFontScale + 0.08))}>
          A+
        </button>
        <button type="button" onClick={() => updateOpacity(localOpacity > 0.82 ? 0.72 : 0.92)}>
          透明
        </button>
        <button type="button" onClick={() => void appInfo?.closeFloatingCaption?.()}>
          关闭
        </button>
      </div>
      <div className="floating-caption-top">
        <span>{caption.compactStatusLabel}</span>
        <span>{caption.languageDirection}</span>
      </div>
      <div className="floating-caption-lines">
        <p className="floating-source">{caption.sourceText}</p>
        <p className="floating-translation">{caption.translatedText}</p>
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
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [desktopSources, setDesktopSources] = useState<DesktopAudioSource[]>([]);
  const [selectedDesktopSourceId, setSelectedDesktopSourceId] = useState("");
  const [asrEvents, setAsrEvents] = useState<AsrEvent[]>([]);
  const [asrSegments, setAsrSegments] = useState<AsrSegment[]>([]);
  const [translationEvents, setTranslationEvents] = useState<TranslationEvent[]>([]);
  const [refinementEvents, setRefinementEvents] = useState<SubtitleRefinementEvent[]>([]);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [captionCueSnapshot, setCaptionCueSnapshot] =
    useState<CaptionCueSnapshot>(emptyCaptionCueSnapshot);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<UiTheme>(loadUiTheme);
  const [fontSize, setFontSize] = useState<UiFontSize>(loadUiFontSize);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [confirmingClearHistory, setConfirmingClearHistory] = useState(false);
  const [floatingCaptionVisible, setFloatingCaptionVisible] = useState(false);
  const floatingLayout: FloatingCaptionLayout = "standard";
  const floatingPosition: FloatingCaptionPosition = "bottom-right";
  const [ttsSession, setTtsSession] = useState<TtsSessionState>(initialTtsSession);
  const [aiRuntimeConfig, setAiRuntimeConfig] = useState<AiRuntimeConfig | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealth | null>(null);
  const [nativeAudioCapability, setNativeAudioCapability] =
    useState<NativeSystemAudioCapability | null>(null);

  const chunkSequenceRef = useRef(0);
  const payloadQueueRef = useRef(new OrderedAudioPayloadQueue(AUDIO_PAYLOAD_QUEUE_MAX_DEPTH));
  const payloadQueuePumpRunningRef = useRef(false);
  const payloadQueueStateRef = useRef<AudioChunkQueueState>(initialQueueState);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const languagePairRef = useRef(activeLanguagePair);
  const providerHealthRef = useRef<ProviderHealth | null>(null);
  const providerAsrEventDeduplicatorRef = useRef(new RealtimeAsrEventDeduplicator());
  const asrClientRef = useRef(createStreamingAsrClient(loadAsrConfig()));
  const translationClientRef = useRef(createTranslationClient());
  const refinementClientRef = useRef(createSubtitleRefinementClient());
  const translationSchedulerRef = useRef(
    createLowLatencyTranslationScheduler(translationClientRef.current, {
      minPartialCharacters: realtimeLatencyTuning.minPartialCharacters,
      minPartialWords: realtimeLatencyTuning.minPartialWords,
      partialDebounceMs: realtimeLatencyTuning.partialDebounceMs
    })
  );
  const refinementSchedulerRef = useRef(
    createSubtitleRefinementScheduler(refinementClientRef.current)
  );
  const latencyAggregatorRef = useRef(new SessionLatencyAggregator());
  const referenceLatencyRunnerRef = useRef(new ProviderLatencyReferenceRunner());
  const subtitleSegmentsRef = useRef<SubtitleSegment[]>([]);
  const captionCueSnapshotRef = useRef<CaptionCueSnapshot>(emptyCaptionCueSnapshot);
  const floatingCaptionStateRef = useRef<FloatingCaptionState>(defaultFloatingCaptionState);
  const ttsSessionRef = useRef<TtsSessionState>(initialTtsSession);
  const captureSessionIdRef = useRef<string | null>(null);
  const captureEpochRef = useRef(0);
  const historyRecordsRef = useRef<HistoryRecord[]>([]);
  const historyLoadedRef = useRef(false);
  const historyWriterRef = useRef<DeferredHistoryWriter | null>(null);

  if (!historyWriterRef.current) {
    historyWriterRef.current = createDeferredHistoryWriter({
      commit(incoming) {
        const stored = historyLoadedRef.current ? [] : loadHistory(window.localStorage);
        const next = upsertHistoryRecords(
          upsertHistoryRecords(stored, historyRecordsRef.current),
          incoming
        );
        historyLoadedRef.current = true;
        historyRecordsRef.current = next;
        setHistoryRecords(next);
        try {
          saveHistory(window.localStorage, next);
          setHistoryMessage(null);
        } catch {
          setHistoryMessage("历史暂时无法保存，当前内容仍会保留到窗口关闭前。");
        }
      }
    });
  }

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
  const activeCue = captionCueSnapshot.active;
  const previousCue = captionCueSnapshot.previous;
  const asrConfig = asrClientRef.current.getConfig();
  const isSessionRunning =
    session.status === "streaming" ||
    providerHealth?.session.state === "connecting" ||
    providerHealth?.session.state === "streaming" ||
    providerHealth?.session.state === "degraded" ||
    providerHealth?.session.state === "reconnecting";
  const primarySessionLabel = isSessionRunning ? "停止同传" : "开始同传";
  const primarySessionAction = isSessionRunning ? stopSession : () => void startSession();
  const liveExperience = useMemo(
    () =>
      createLiveExperienceState({
        session,
        providerHealth,
        nativeAudioCapability
      }),
    [nativeAudioCapability, providerHealth, session]
  );
  const historyGroups = useMemo(() => groupHistoryRecords(historyRecords), [historyRecords]);
  const recentContextGroups = useMemo(
    () =>
      historyGroups
        .filter(
          (group) =>
            !group.records.some(
              (record) =>
                record.sessionId === captureSessionIdRef.current &&
                record.segmentId === `${captureEpochRef.current}:${latestSubtitleSegment?.id}`
            )
        )
        .slice(0, 3),
    [historyGroups, latestSubtitleSegment?.id]
  );

  const floatingCaptionState = useMemo<FloatingCaptionState>(
    () => ({
      translatedText:
        activeCue?.translatedText ||
        (activeCue?.sourceText ? "正在生成译文" : latestAsrSegment ? "正在等待稳定片段生成译文" : "等待字幕"),
      sourceText: activeCue?.sourceText ?? latestAsrSegment?.text ?? selectedSource.description,
      previousText: previousCue ? previousCue.translatedText || previousCue.sourceText : null,
      statusLabel: activeCue
        ? activeCue.revised
          ? "字幕已修订"
          : activeCue.state === "listening" || activeCue.state === "drafting"
            ? "正在听译"
            : "实时字幕"
        : liveExperience.label,
      compactStatusLabel: liveExperience.compactLabel,
      severity: liveExperience.severity,
      languageDirection: activeLanguagePair.label,
      sessionStatus: liveExperience.label,
      latencyLabel: activeCue?.latency.totalLatencyMs !== null && activeCue?.latency.totalLatencyMs !== undefined
        ? `${activeCue.latency.totalLatencyMs} ms`
        : latestAsrEvent
          ? `${latestAsrEvent.latencyMs} ms`
          : "等待字幕",
      revised: Boolean(activeCue?.revised),
      locked: floatingCaptionStateRef.current.locked,
      mousePassthrough: floatingCaptionStateRef.current.mousePassthrough,
      opacity: floatingCaptionStateRef.current.opacity,
      fontScale: floatingCaptionStateRef.current.fontScale,
      controlsVisible: true,
      updatedAtMs: Date.now()
    }),
    [
      activeLanguagePair.label,
      activeCue,
      latestAsrEvent,
      latestAsrSegment,
      liveExperience,
      previousCue,
      selectedSource.description,
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
    }, realtimeLatencyTuning.audioChunkDurationMs);

    return () => window.clearInterval(timer);
  }, [session.selectedFile, session.sourceType, session.status]);

  useEffect(() => {
    return () => {
      cleanupActiveCapture();
    };
  }, []);

  useEffect(() => {
    let timerId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      timerId = window.setTimeout(() => {
        const stored = loadHistory(window.localStorage);
        const next = upsertHistoryRecords(stored, historyRecordsRef.current);
        historyLoadedRef.current = true;
        historyRecordsRef.current = next;
        setHistoryRecords(next);
      }, 250);
    });

    const flushHistory = () => historyWriterRef.current?.flush();
    window.addEventListener("beforeunload", flushHistory);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener("beforeunload", flushHistory);
      historyWriterRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_THEME_KEY, theme);
    } catch {
      setHistoryMessage("界面偏好暂时无法保存。");
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(UI_FONT_SIZE_KEY, fontSize);
    } catch {
      setHistoryMessage("界面偏好暂时无法保存。");
    }
  }, [fontSize]);

  useEffect(() => {
    void refreshDesktopAudioSources();
  }, []);

  useEffect(() => {
    languagePairRef.current = activeLanguagePair;
    savePreferredLanguagePair(activeLanguagePair.id);
  }, [activeLanguagePair]);

  useEffect(() => {
    providerHealthRef.current = providerHealth;
  }, [providerHealth]);

  useEffect(() => {
    captionCueSnapshotRef.current = captionCueSnapshot;
  }, [captionCueSnapshot]);

  useEffect(() => {
    floatingCaptionStateRef.current = floatingCaptionState;
    appInfo?.updateFloatingCaption?.(floatingCaptionState);
  }, [appInfo, floatingCaptionState]);

  useEffect(() => {
    ttsSessionRef.current = ttsSession;
  }, [ttsSession]);

  useEffect(() => {
    void appInfo?.getAiRuntimeConfig?.().then(setAiRuntimeConfig);
    void appInfo?.getProviderHealth?.().then((nextHealth) => {
      providerHealthRef.current = nextHealth;
      setProviderHealth(nextHealth);
    });
  }, [appInfo]);

  useEffect(() => {
    void appInfo?.getSystemAudioCaptureCapability?.().then(setNativeAudioCapability);
  }, [appInfo]);

  useEffect(() => {
    if (!appInfo?.onRealtimeProviderAsrEvent) {
      return undefined;
    }

    return appInfo.onRealtimeProviderAsrEvent((event) => {
      publishRealtimeProviderAsrEvents([event]);
    });
  }, [appInfo]);

  useEffect(() => {
    if (!appInfo?.pullRealtimeProviderAsrEvents || !providerHealth?.session.sessionId) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      void appInfo.pullRealtimeProviderAsrEvents?.().then(publishRealtimeProviderAsrEvents);
    }, realtimeLatencyTuning.providerAsrPollIntervalMs);

    return () => window.clearInterval(timer);
  }, [appInfo, providerHealth?.session.sessionId]);

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

  function toProviderQueueSnapshot(queue: AudioChunkQueueState): RealtimeProviderQueueSnapshot {
    return {
      depth: queue.depth,
      maxDepth: queue.maxDepth,
      dropped: queue.dropped,
      lastSequence: queue.lastSequence,
      lastPayloadBytes: queue.lastPayloadBytes
    };
  }

  async function refreshProviderStatus(): Promise<ProviderHealth | null> {
    if (!appInfo?.getProviderHealth) {
      return null;
    }

    const nextHealth = await appInfo.getProviderHealth();
    providerHealthRef.current = nextHealth;
    setProviderHealth(nextHealth);
    return nextHealth;
  }

  function shouldUseRealtimeProviderShell(health = providerHealth): boolean {
    return Boolean(health?.config.realtimeEnabled);
  }

  function syncCaptionCueSnapshot(
    nextAsrSegments: AsrSegment[],
    nextTranslationEvents: TranslationEvent[] = [],
    nextRefinementEvents: SubtitleRefinementEvent[] = []
  ): void {
    setCaptionCueSnapshot((current) => {
      const candidate = [...nextAsrSegments].sort(
        (left, right) => right.updatedAtMs - left.updatedAtMs
      )[0];
      if (
        current.active &&
        candidate &&
        candidate.id !== current.active.id &&
        candidate.startedAtMs < current.active.rollbackGuardStartedAtMs
      ) {
        translationSchedulerRef.current.recordRollbackBlock();
      }
      const next = updateCaptionCueSnapshot({
        current,
        asrSegments: nextAsrSegments,
        translationEvents: nextTranslationEvents,
        refinementEvents: nextRefinementEvents,
        nowMs: Date.now(),
        sourceLanguageLabel: languagePairRef.current.source.label,
        targetLanguageLabel: languagePairRef.current.target.label
      });
      captionCueSnapshotRef.current = next;
      return next;
    });
  }

  function publishRealtimeProviderAsrEvents(events: RealtimeProviderAsrEvent[]): void {
    const uniqueEvents = providerAsrEventDeduplicatorRef.current.filter(events);

    if (uniqueEvents.length === 0) {
      return;
    }

    const asrEventsFromProvider: AsrEvent[] = uniqueEvents.map((event) => ({
      id: event.id,
      segmentId: event.segmentId,
      chunkId: event.chunkId,
      sourceType: event.sourceType,
      sequence: event.sequence,
      audioStartMs: event.audioStartMs,
      audioEndMs: event.audioEndMs,
      text: event.text,
      status: event.status,
      revision: event.revision,
      receivedAtMs: event.receivedAtMs,
      audioEvidenceEndAtMs: event.audioEvidenceEndAtMs,
      asrReceivedAtMs: event.asrReceivedAtMs,
      timingCorrelation: event.timingCorrelation,
      latencyMs: event.latencyMs
    }));

    const nextSegments: AsrSegment[] = asrEventsFromProvider.map((event) => ({
      id: event.segmentId,
      sourceType: event.sourceType,
      text: event.text,
      status: event.status,
      startedAtMs: event.audioStartMs,
      endedAtMs: event.audioEndMs,
      updatedAtMs: event.receivedAtMs,
      audioEvidenceEndAtMs: event.audioEvidenceEndAtMs,
      asrReceivedAtMs: event.asrReceivedAtMs,
      timingCorrelation: event.timingCorrelation,
      latencyMs: event.latencyMs,
      revision: event.revision
    }));

    setAsrEvents((current) => [...asrEventsFromProvider, ...current].slice(0, 8));
    setAsrSegments((current) => {
      const byId = new Map(current.map((segment) => [segment.id, segment]));
      nextSegments.forEach((segment) => {
        byId.set(segment.id, segment);
      });
      return Array.from(byId.values())
        .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
        .slice(0, 6);
    });
    syncCaptionCueSnapshot(nextSegments);
    updateInternalDiagnostics();
    void publishTranslationEvents(nextSegments);
  }

  async function startRealtimeProviderShell(sourceType: "system" | "microphone"): Promise<void> {
    const currentHealth = providerHealthRef.current ?? providerHealth ?? (await refreshProviderStatus());

    if (!appInfo?.startRealtimeProviderSession || !shouldUseRealtimeProviderShell(currentHealth)) {
      return;
    }

    const nextHealth = await appInfo.startRealtimeProviderSession({
      sourceType,
      languagePairId: activeLanguagePair.id,
      sourceLanguageCode: activeLanguagePair.source.code,
      queue: toProviderQueueSnapshot(initialQueueState)
    });
    providerHealthRef.current = nextHealth;
    setProviderHealth(nextHealth);

    if (nextHealth.session.state === "missing-config" || nextHealth.session.state === "error") {
      throw new Error(nextHealth.session.error || "实时服务配置不可用。");
    }
  }

  async function stopRealtimeProviderShell(): Promise<void> {
    if (!appInfo?.stopRealtimeProviderSession || !providerHealth?.config.realtimeEnabled) {
      return;
    }

    const nextHealth = await appInfo.stopRealtimeProviderSession();
    providerHealthRef.current = nextHealth;
    setProviderHealth(nextHealth);
  }

  async function streamChunkToRealtimeProvider(
    chunk: NormalizedAudioChunk,
    queue: AudioChunkQueueState
  ): Promise<void> {
    if (
      chunk.sourceType === "file" ||
      !chunk.payload ||
      chunk.payload.encoding !== "pcm16-base64" ||
      chunk.payload.sampleFormat !== "s16le" ||
      !appInfo?.appendRealtimeProviderAudioChunk
    ) {
      return;
    }

    const payload: RealtimeProviderAudioPayload = {
      encoding: "pcm16-base64",
      sampleFormat: "s16le",
      sampleRate: chunk.payload.sampleRate,
      channels: chunk.payload.channels,
      frameCount: chunk.payload.frameCount,
      byteLength: chunk.payload.byteLength,
      durationMs: chunk.payload.durationMs,
      data: chunk.payload.data
    };

    const response = await appInfo.appendRealtimeProviderAudioChunk({
      id: chunk.id,
      sourceType: chunk.sourceType,
      sequence: chunk.sequence,
      timestampMs: chunk.timestampMs,
      capturedAtMs: chunk.payloadMetadata.producedAtMs || Date.now(),
      durationMs: chunk.durationMs,
      volume: chunk.volume,
      queue: toProviderQueueSnapshot(queue),
      payload
    });
    providerHealthRef.current = response.health;
    setProviderHealth(response.health);
    publishRealtimeProviderAsrEvents(response.events);
  }

  function publishPayloadQueueState(queue: AudioChunkQueueState): void {
    payloadQueueStateRef.current = queue;
    setSession((current) => ({ ...current, queue }));
  }

  async function drainRealtimeProviderAudioQueue(): Promise<void> {
    if (payloadQueuePumpRunningRef.current) {
      return;
    }

    payloadQueuePumpRunningRef.current = true;
    try {
      let chunk = payloadQueueRef.current.take();
      while (chunk) {
        try {
          await streamChunkToRealtimeProvider(chunk, payloadQueueRef.current.snapshot());
        } catch (error) {
          setSession((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "实时 ASR 音频发送失败。"
          }));
        } finally {
          publishPayloadQueueState(payloadQueueRef.current.complete(chunk.id));
        }
        chunk = payloadQueueRef.current.take();
      }
    } finally {
      payloadQueuePumpRunningRef.current = false;
    }
  }

  function recordChunk(chunk: NormalizedAudioChunk): void {
    const usesRealtimeProvider =
      chunk.sourceType !== "file" &&
      chunk.payloadMetadata.providerReady &&
      shouldUseRealtimeProviderShell(providerHealthRef.current);
    const nextQueue = usesRealtimeProvider
      ? payloadQueueRef.current.enqueue(chunk)
      : payloadQueueRef.current.reset(true);
    payloadQueueStateRef.current = nextQueue;
    setSession((current) => ({
      ...current,
      lastChunk: chunk,
      chunksProduced: current.chunksProduced + 1,
      volume: chunk.volume,
      queue: nextQueue,
      error: null
    }));
    if (usesRealtimeProvider) {
      void drainRealtimeProviderAudioQueue();
      return;
    }

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
      audioEvidenceEndAtMs: event.audioEvidenceEndAtMs,
      asrReceivedAtMs: event.asrReceivedAtMs,
      timingCorrelation: event.timingCorrelation,
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

    syncCaptionCueSnapshot(nextSegments);
    void publishTranslationEvents(nextSegments);
  }

  function publishTranslationEvents(changedSegments: AsrSegment[]): void {
    if (changedSegments.length === 0) {
      return;
    }

    const ordered = [...changedSegments].sort(
      (left, right) => left.updatedAtMs - right.updatedAtMs
    );
    const latestId = ordered.at(-1)?.id;

    ordered.forEach((segment) => {
      const activeCue = captionCueSnapshotRef.current.active;
      const belongsToOlderSpeech = Boolean(
        activeCue &&
          segment.id !== activeCue.id &&
          segment.startedAtMs < activeCue.rollbackGuardStartedAtMs
      );
      const lane =
        segment.status === "final" && (belongsToOlderSpeech || segment.id !== latestId)
          ? "backfill"
          : "active";
      void translationSchedulerRef.current
        .schedule({
          segment,
          languagePair: languagePairRef.current,
          context: getSubtitleContextItems(subtitleSegmentsRef.current, 3),
          nowMs: Date.now(),
          lane,
          onDraft: (event) => commitTranslationEvent(segment, event)
        })
        .then((event) => {
          if (event) {
            commitTranslationEvent(segment, event);
          }
        })
        .catch((error) => {
          setSession((current) => ({
            ...current,
            error: `翻译服务：${error instanceof Error ? error.message : "请求失败"}`
          }));
        });
    });
  }

  function enqueueHistorySegments(segments: SubtitleSegment[]): void {
    const sessionId = captureSessionIdRef.current ?? createCaptureSessionId();
    captureSessionIdRef.current = sessionId;
    const records = toHistoryRecords(segments, {
      sessionId,
      captureEpoch: captureEpochRef.current,
      sourceType: session.sourceType,
      languagePairId: activeLanguagePair.id
    });
    if (records.length > 0) historyWriterRef.current?.enqueue(records);
  }

  function commitSubtitleSegments(nextSegments: SubtitleSegment[]): void {
    subtitleSegmentsRef.current = nextSegments;
    setSubtitleSegments(nextSegments);
    enqueueHistorySegments(nextSegments);
  }

  function commitTranslationEvent(segment: AsrSegment, event: TranslationEvent): void {
    const firstDraftVisibleAtMs = Date.now();
    const visibleEvent: TranslationEvent = {
      ...event,
      firstDraftVisibleAtMs: event.firstDraftVisibleAtMs ?? firstDraftVisibleAtMs,
      finalVisibleAtMs:
        segment.status === "final" && event.complete !== false
          ? event.finalVisibleAtMs ?? firstDraftVisibleAtMs
          : event.finalVisibleAtMs ?? null
    };
    const latencySample = {
      id: visibleEvent.id,
      providerBacked: visibleEvent.provider !== "mock",
      fallback: visibleEvent.fallback,
      error: visibleEvent.error,
      audioEvidenceEndAtMs: visibleEvent.audioEvidenceEndAtMs,
      asrReceivedAtMs: visibleEvent.asrReceivedAtMs,
      translationEligibleAtMs: visibleEvent.translationEligibleAtMs,
      translationRequestedAtMs: visibleEvent.translationRequestedAtMs,
      firstDraftReceivedAtMs: visibleEvent.firstDraftReceivedAtMs,
      firstDraftVisibleAtMs: visibleEvent.firstDraftVisibleAtMs,
      finalVisibleAtMs: visibleEvent.finalVisibleAtMs,
      refinementVisibleAtMs: visibleEvent.refinementVisibleAtMs
    };
    latencyAggregatorRef.current.record(latencySample);
    referenceLatencyRunnerRef.current.recordSample(latencySample);

    setTranslationEvents((current) => [visibleEvent, ...current].slice(0, 8));
    if (visibleEvent.error) {
      setSession((current) => ({
        ...current,
        error: `翻译服务：${visibleEvent.error}`
      }));
    }

    const { segments: nextSegments } = reconcileSubtitleSegments({
      current: subtitleSegmentsRef.current,
      translationEvents: [visibleEvent],
      asrSegments: [segment],
      revisionWindow: RECENT_REVISION_WINDOW,
      providerConnectionState: providerHealthRef.current?.session.state ?? null
    });
    commitSubtitleSegments(nextSegments);
    if (!visibleEvent.historyBackfill) {
      translationSchedulerRef.current.markVisible(segment.id, firstDraftVisibleAtMs, segment.updatedAtMs);
      syncCaptionCueSnapshot([segment], [visibleEvent]);
    }
    updateRefinementPressure();
    updateInternalDiagnostics();
    window.setTimeout(updateRefinementPressure, 0);
    void publishRefinementEvents([segment], [visibleEvent]);
  }

  function updateRefinementPressure(): void {
    const translation = translationSchedulerRef.current.getDiagnostics();
    const queue = providerHealthRef.current?.session.queue;
    const asrQueueRatio = queue && queue.maxDepth > 0 ? queue.depth / queue.maxDepth : 0;
    refinementSchedulerRef.current.updatePressure({
      activeLag: translation.activeLag,
      translationBacklog: translation.activeLaneDepth + translation.backfillDepth,
      asrQueueRatio,
      fastDraftLatencyMs:
        captionCueSnapshotRef.current.active?.latency.fastDraftLatencyMs ??
        translation.lastVisibleLatencyMs
    });
  }

  function updateInternalDiagnostics(): void {
    const health = providerHealthRef.current;
    const snapshot = createRealtimeDiagnosticsSnapshot({
      latency: latencyAggregatorRef.current.snapshot(),
      translation: translationSchedulerRef.current.getDiagnostics(),
      refinement: refinementSchedulerRef.current.getDiagnostics(),
      providerQueue: health?.session.queue,
      providerTiming: health?.session.timing
    });
    (window as Window & { __realtimeDiagnostics?: RealtimeDiagnosticsSnapshot }).__realtimeDiagnostics =
      snapshot;
    referenceLatencyRunnerRef.current.recordCatchUp({
      atMs: snapshot.capturedAtMs,
      activeLag: snapshot.translation.activeLag,
      pressureActive: snapshot.refinement.paused,
      catchUpState: snapshot.translation.catchUpState
    });
    const referenceReport = referenceLatencyRunnerRef.current.report({
      requestCount: snapshot.translation.requestCount,
      supersededPartials: snapshot.translation.supersededPartials,
      cancellationAttempts: snapshot.translation.cancellationAttempts,
      cancellationSucceeded: snapshot.translation.cancellationSucceeded,
      cancellationIgnored: snapshot.translation.cancellationIgnored
    });
    (window as Window & { __realtimeReferenceReport?: ReferenceLatencyReport })
      .__realtimeReferenceReport = referenceReport;
  }

  async function publishRefinementEvents(
    changedSegments: AsrSegment[],
    nextTranslationEvents: TranslationEvent[]
  ): Promise<void> {
    updateRefinementPressure();
    const eligibleEvents = nextTranslationEvents.filter((event) => {
      const segment = changedSegments.find((item) => item.id === event.segmentId);
      return (
        segment?.status === "final" &&
        event.complete !== false &&
        !event.error &&
        Boolean(event.translatedText.trim())
      );
    });

    if (eligibleEvents.length === 0) {
      return;
    }

    const nextRefinements = (
      await Promise.all(
        eligibleEvents.map((event) => {
          const segment = changedSegments.find((item) => item.id === event.segmentId);

          if (!segment) {
            return Promise.resolve(null);
          }

          return refinementSchedulerRef.current.schedule({
            segmentId: event.segmentId,
            sourceText: event.sourceText,
            translatedText: event.translatedText,
            languagePair: languagePairRef.current,
            context: getSubtitleContextItems(subtitleSegmentsRef.current, 3),
            revision: event.revision,
            status: segment.status === "final" ? "final" : "partial",
            terminologyHints: [],
            firstDraftVisibleAtMs: event.firstDraftVisibleAtMs
          });
        })
      )
    ).filter((event): event is SubtitleRefinementEvent => Boolean(event));

    const refinementVisibleAtMs = Date.now();
    const visibleRefinements = nextRefinements.map((event) => ({
      ...event,
      refinementVisibleAtMs: event.refinementVisibleAtMs ?? refinementVisibleAtMs
    }));

    if (visibleRefinements.length === 0) {
      return;
    }

    visibleRefinements.forEach((refinement) => {
      const translation = nextTranslationEvents.find(
        (event) => event.segmentId === refinement.segmentId
      );
      if (!translation) {
        return;
      }
      const latencySample = {
        id: translation.id,
        providerBacked: translation.provider !== "mock",
        fallback: translation.fallback || refinement.fallback,
        error: translation.error ?? refinement.error,
        audioEvidenceEndAtMs: translation.audioEvidenceEndAtMs,
        asrReceivedAtMs: translation.asrReceivedAtMs,
        translationEligibleAtMs: translation.translationEligibleAtMs,
        translationRequestedAtMs: translation.translationRequestedAtMs,
        firstDraftReceivedAtMs: translation.firstDraftReceivedAtMs,
        firstDraftVisibleAtMs: translation.firstDraftVisibleAtMs,
        finalVisibleAtMs: translation.finalVisibleAtMs,
        refinementVisibleAtMs: refinement.refinementVisibleAtMs
      };
      latencyAggregatorRef.current.record(latencySample);
      referenceLatencyRunnerRef.current.recordSample(latencySample);
    });
    updateInternalDiagnostics();

    setRefinementEvents((current) => [...visibleRefinements, ...current].slice(0, 8));
    const { segments: nextSegments } = reconcileSubtitleSegments({
      current: subtitleSegmentsRef.current,
      translationEvents: [],
      refinementEvents: visibleRefinements,
      asrSegments: changedSegments,
      revisionWindow: RECENT_REVISION_WINDOW,
      providerConnectionState: providerHealthRef.current?.session.state
    });
    commitSubtitleSegments(nextSegments);
    syncCaptionCueSnapshot(changedSegments, nextTranslationEvents, visibleRefinements);
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
          audioEvidenceEndAtMs: Math.max(0, now - (index === 0 ? latencyMs : 180)),
          asrReceivedAtMs: now,
          timingCorrelation: "segment-revision",
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
          audioEvidenceEndAtMs: asrEvent.audioEvidenceEndAtMs,
          asrReceivedAtMs: asrEvent.asrReceivedAtMs,
          timingCorrelation: asrEvent.timingCorrelation,
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
    providerAsrEventDeduplicatorRef.current.reset();
    translationSchedulerRef.current.reset();
    refinementSchedulerRef.current.reset();
    latencyAggregatorRef.current.reset();
    referenceLatencyRunnerRef.current.reset();
    setAsrEvents([]);
    setAsrSegments([]);
    setTranslationEvents([]);
    setRefinementEvents([]);
    setSubtitleSegments([]);
    setCaptionCueSnapshot(emptyCaptionCueSnapshot);
    subtitleSegmentsRef.current = [];
    captionCueSnapshotRef.current = emptyCaptionCueSnapshot;
    clearTtsQueue();
  }

  function updateLanguagePair(pairId: string): void {
    const nextPair = getLanguagePair(pairId);
    captureSessionIdRef.current = null;
    captureEpochRef.current = 0;
    setActiveLanguagePair(nextPair);
    resetAsrState();
  }

  function resetInputState(type: AudioSourceType): void {
    chunkSequenceRef.current = 0;
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
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

    audioProcessorRef.current?.disconnect();
    audioProcessorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function updateSourceType(type: AudioSourceType): void {
    cleanupActiveCapture();
    void stopRealtimeProviderShell();
    captureSessionIdRef.current = null;
    captureEpochRef.current = 0;
    resetInputState(type);

    if (type === "microphone" && microphoneDevices.length === 0) {
      void refreshMicrophoneDevices();
    }

    if (type === "system" && desktopSources.length === 0) {
      void refreshDesktopAudioSources();
    }
  }

  async function refreshDesktopAudioSources(): Promise<DesktopAudioSource[]> {
    if (!appInfo?.listDesktopAudioSources) {
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        error: "当前运行环境无法枚举桌面音频源。"
      }));
      return [];
    }

    try {
      const sources = await appInfo.listDesktopAudioSources();
      setDesktopSources(sources);
      setSelectedDesktopSourceId((current) =>
        sources.some((source) => source.id === current) ? current : sources[0]?.id || ""
      );
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: sources.length > 0 ? "ready" : "error",
        error: sources.length > 0 ? null : "没有发现可用的桌面或窗口来源。"
      }));
      return sources;
    } catch (error) {
      setSession((current) => ({
        ...current,
        sourceType: "system",
        status: "error",
        error: error instanceof Error ? error.message : "桌面音频源枚举失败。"
      }));
      return [];
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
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const pcmBuffer: number[] = [];
    const samplesPerChunk = Math.round(
      (audioContext.sampleRate * realtimeLatencyTuning.audioChunkDurationMs) / 1000
    );
    analyser.fftSize = 1024;
    source.connect(analyser);
    source.connect(processor);
    processor.connect(audioContext.destination);
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      input.forEach((sample) => {
        pcmBuffer.push(sample);
      });
    };

    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioProcessorRef.current = processor;

    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
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
      const floatSamples =
        pcmBuffer.length >= samplesPerChunk
          ? new Float32Array(pcmBuffer.splice(0, samplesPerChunk))
          : new Float32Array(0);
      const payload =
        floatSamples.length > 0
          ? createPcm16PayloadFromFloatSamples(
              floatSamples,
              audioContext.sampleRate,
              1,
              realtimeLatencyTuning.audioChunkDurationMs
            )
          : createPcm16PayloadFromTimeDomainSamples(
              snapshot.samples,
              audioContext.sampleRate,
              1,
              realtimeLatencyTuning.audioChunkDurationMs
            );
      const volume =
        floatSamples.length > 0 ? getVolumeFromFloatSamples(floatSamples) : snapshot.volume;
      const chunk =
        sourceType === "microphone"
          ? createCapturedMicrophoneChunk(chunkSequenceRef.current, volume, sourceLabel, payload)
          : createCapturedSystemAudioChunk(chunkSequenceRef.current, volume, sourceLabel, payload);
      chunkSequenceRef.current += 1;
      recordChunk(chunk);
    }, realtimeLatencyTuning.audioChunkDurationMs);
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
      resetAsrState();
      await startRealtimeProviderShell("microphone");

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
      void stopRealtimeProviderShell();
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
    let availableSources = desktopSources;
    let sourceId = selectedDesktopSourceId || availableSources[0]?.id;

    if (!sourceId) {
      availableSources = await refreshDesktopAudioSources();
      sourceId = availableSources[0]?.id;
    }

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
      resetAsrState();
      await startRealtimeProviderShell("system");

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
      const sourceName =
        availableSources.find((source) => source.id === sourceId)?.name ??
        selectedDesktopSourceName;
      startAnalyserCapture(stream, "system", sourceName);
    } catch (error) {
      cleanupActiveCapture();
      void stopRealtimeProviderShell();
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
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
    captureSessionIdRef.current = null;
    captureEpochRef.current = 0;
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
    if (captureSessionIdRef.current) {
      captureEpochRef.current += 1;
    } else {
      captureSessionIdRef.current = createCaptureSessionId();
      captureEpochRef.current = 0;
    }
    if (
      session.sourceType === "file" &&
      aiRuntimeConfig?.provider === "openai" &&
      aiRuntimeConfig.asrMode === "provider"
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
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
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
        model: aiRuntimeConfig?.asrModel ?? asrConfig.model
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

  function stopSession(): void {
    cleanupActiveCapture();
    void stopRealtimeProviderShell();
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
    setSession((current) => ({
      ...current,
      status: "stopped",
      volume: 0,
      queue: initialQueueState,
      error: null
    }));
  }

  function retryCurrentSource(): void {
    cleanupActiveCapture();
    void stopRealtimeProviderShell();
    payloadQueueRef.current.reset();
    payloadQueueStateRef.current = initialQueueState;
    setSession((current) => ({
      ...current,
      status: current.selectedFile || current.sourceType !== "file" ? "ready" : "idle",
      volume: 0,
      queue: initialQueueState,
      error: null
    }));
    window.setTimeout(() => {
      void startSession();
    }, 0);
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

  async function copyHistory(): Promise<void> {
    historyWriterRef.current?.flush();
    const content = serializeHistoryText(groupHistoryRecords(historyRecordsRef.current));
    if (!content) return;

    try {
      await navigator.clipboard.writeText(content);
      setHistoryMessage("历史已复制。");
    } catch {
      setHistoryMessage("复制失败，请检查剪贴板权限。");
    }
  }

  async function exportHistory(): Promise<void> {
    historyWriterRef.current?.flush();
    const content = serializeHistoryText(groupHistoryRecords(historyRecordsRef.current));
    if (!content || !appInfo?.exportSubtitleHistory) return;

    try {
      const saved = await appInfo.exportSubtitleHistory(
        content,
        `同声传译字幕-${new Date().toISOString().slice(0, 10)}.txt`
      );
      if (saved) setHistoryMessage("历史已导出。");
    } catch {
      setHistoryMessage("导出失败，请重新选择保存位置。");
    }
  }

  function removeHistory(): void {
    historyWriterRef.current?.flush();
    try {
      clearHistory(window.localStorage);
    } catch {
      setHistoryMessage("历史暂时无法清空。");
      return;
    }
    historyRecordsRef.current = [];
    setHistoryRecords([]);
    setConfirmingClearHistory(false);
    setHistoryMessage("历史已清空。");
  }

  function unlockFloatingCaption(): void {
    floatingCaptionStateRef.current = {
      ...floatingCaptionStateRef.current,
      locked: false,
      mousePassthrough: false
    };
    void appInfo?.setFloatingCaptionInteraction?.({ locked: false, mousePassthrough: false });
    appInfo?.updateFloatingCaption?.(floatingCaptionStateRef.current);
  }

  const activeSourceText = activeCue?.sourceText ?? latestAsrSegment?.text ?? selectedSource.description;
  const activeTranslatedText =
    activeCue?.translatedText ||
    (activeCue?.sourceText || latestAsrSegment
      ? "正在生成译文"
      : session.sourceType === "system"
        ? `当前来源：${selectedDesktopSourceName}`
        : session.sourceType === "microphone"
          ? `当前设备：${selectedMicrophoneLabel}`
          : session.selectedFile
            ? `已选择 ${session.selectedFile.name}`
            : "选择来源后点击开始同传");

  return (
    <main className={`lite-shell theme-${theme} font-${fontSize}`} aria-label="同声传译">
      <header className="compact-toolbar">
        <select
          className="language-select"
          value={activeLanguagePair.id}
          aria-label="选择语言方向"
          onChange={(event) => updateLanguagePair(event.target.value)}
        >
          {supportedLanguagePairs.map((pair) => (
            <option key={pair.id} value={pair.id}>{pair.label}</option>
          ))}
        </select>
        <button type="button" className="primary-action compact-primary" onClick={primarySessionAction}>
          {isSessionRunning ? "暂停" : session.status === "stopped" ? "继续" : "开始"}
        </button>
        <button
          type="button"
          className={`icon-button ${historyExpanded ? "icon-button-active" : ""}`}
          aria-label={historyExpanded ? "收起字幕历史" : "展开字幕历史"}
          title={historyExpanded ? "收起字幕历史" : "字幕历史"}
          aria-expanded={historyExpanded}
          onClick={() => {
            setHistoryExpanded((value) => !value);
            setSettingsOpen(false);
          }}
        >
          <History size={19} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`icon-button ${settingsOpen ? "icon-button-active" : ""}`}
          aria-label={settingsOpen ? "关闭设置" : "打开设置"}
          title="设置"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((value) => !value)}
        >
          <Settings size={19} aria-hidden="true" />
        </button>
      </header>

      {settingsOpen ? (
        <section className="settings-popover" aria-label="设置">
          <div className="settings-heading">
            <h2>设置</h2>
            <button type="button" className="icon-button" aria-label="关闭设置" title="关闭" onClick={() => setSettingsOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="settings-grid">
            <label className="setting-field">
              <span>音频源</span>
              <select value={session.sourceType} onChange={(event) => updateSourceType(event.target.value as AudioSourceType)}>
                {sourceOptions.map((option) => <option key={option.type} value={option.type}>{option.label}</option>)}
              </select>
            </label>

            {session.sourceType === "system" ? (
              <label className="setting-field setting-field-wide">
                <span>桌面来源</span>
                <div className="setting-inline">
                  <select value={selectedDesktopSourceId} onChange={(event) => setSelectedDesktopSourceId(event.target.value)}>
                    {desktopSources.length === 0 ? <option value="">默认桌面源</option> : desktopSources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                  </select>
                  <button type="button" className="text-button" onClick={() => void refreshDesktopAudioSources()}>刷新</button>
                </div>
              </label>
            ) : null}

            {session.sourceType === "microphone" ? (
              <label className="setting-field setting-field-wide">
                <span>麦克风</span>
                <div className="setting-inline">
                  <select value={selectedMicrophoneId} onChange={(event) => setSelectedMicrophoneId(event.target.value)}>
                    {microphoneDevices.length === 0 ? <option value="">默认麦克风</option> : microphoneDevices.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
                  </select>
                  <button type="button" className="text-button" onClick={() => void refreshMicrophoneDevices()}>刷新</button>
                </div>
              </label>
            ) : null}

            {session.sourceType === "file" ? (
              <div className="setting-field setting-field-wide">
                <span>本地文件</span>
                <button type="button" className="file-picker" onClick={selectLocalFile}>
                  <MonitorUp size={17} aria-hidden="true" />
                  <span>{session.selectedFile?.name ?? "选择音频或视频文件"}</span>
                </button>
              </div>
            ) : null}

            <label className="setting-field">
              <span>字号</span>
              <select value={fontSize} onChange={(event) => setFontSize(event.target.value as UiFontSize)}>
                <option value="small">小</option>
                <option value="medium">中</option>
                <option value="large">大</option>
              </select>
            </label>
            <label className="setting-field">
              <span>主题</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as UiTheme)}>
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>

            <label className="toggle-row">
              <span>悬浮字幕</span>
              <input type="checkbox" checked={floatingCaptionVisible} onChange={() => void (floatingCaptionVisible ? closeFloatingCaption() : openFloatingCaption())} />
            </label>
            <label className="toggle-row">
              <span>译文播报</span>
              <input type="checkbox" checked={ttsSession.enabled} onChange={(event) => setTtsEnabled(event.target.checked)} />
            </label>
          </div>
          <div className="settings-secondary-actions">
            <button type="button" className="text-button" onClick={unlockFloatingCaption}>解锁字幕</button>
            <button type="button" className="text-button" onClick={() => void appInfo?.resetFloatingCaption?.()}>重置位置</button>
            {ttsSession.enabled ? <button type="button" className="text-button" onClick={pauseTts}>{ttsSession.status === "paused" ? "继续播报" : "暂停播报"}</button> : null}
            {ttsSession.enabled ? <button type="button" className="text-button" onClick={clearTtsQueue}>停止播报</button> : null}
          </div>
          {ttsSession.error ? <p className="inline-error">{ttsSession.error}</p> : null}
        </section>
      ) : null}

      <section className="caption-stage" aria-live="polite" aria-label="当前字幕">
        <div className="recent-context" aria-label="最近上下文">
          {recentContextGroups.map((group) => (
            <p key={group.id}>{group.translatedText || group.sourceText}</p>
          ))}
        </div>
        <div className="current-caption">
          <div className="caption-slot source-caption-slot">
            <p className="source-caption">{activeSourceText}</p>
          </div>
          <div className="caption-slot translated-caption-slot">
            <p className="translated-caption">{activeTranslatedText}</p>
          </div>
        </div>
        {session.error ? <p className="inline-error" role="alert">{session.error}</p> : null}
      </section>

      {historyExpanded ? (
        <section className="history-panel" aria-label="字幕历史">
          <div className="history-toolbar">
            <div>
              <h2>字幕历史</h2>
              <span>{historyGroups.length} 段</span>
            </div>
            <div className="history-actions">
              <button type="button" className="icon-button" aria-label="复制全部历史" title="复制全部" disabled={historyGroups.length === 0} onClick={() => void copyHistory()}><Clipboard size={18} aria-hidden="true" /></button>
              <button type="button" className="icon-button" aria-label="导出历史为 TXT" title="导出 TXT" disabled={historyGroups.length === 0} onClick={() => void exportHistory()}><Download size={18} aria-hidden="true" /></button>
              <button type="button" className="icon-button danger-button" aria-label="清空历史" title="清空历史" disabled={historyGroups.length === 0} onClick={() => setConfirmingClearHistory(true)}><Trash2 size={18} aria-hidden="true" /></button>
              <button type="button" className="icon-button" aria-label="收起字幕历史" title="收起" onClick={() => setHistoryExpanded(false)}><ChevronDown size={19} aria-hidden="true" /></button>
            </div>
          </div>
          {confirmingClearHistory ? (
            <div className="confirm-strip" role="alert">
              <span>确认清空全部字幕历史？</span>
              <button type="button" className="text-button danger-text" onClick={removeHistory}><Check size={15} aria-hidden="true" />确认</button>
              <button type="button" className="text-button" onClick={() => setConfirmingClearHistory(false)}>取消</button>
            </div>
          ) : null}
          {historyMessage ? <p className="history-message" role="status">{historyMessage}</p> : null}
          <div className="history-groups">
            {historyGroups.length === 0 ? (
              <p className="empty-history">开始同传后，连续内容会整理在这里。</p>
            ) : historyGroups.slice(0, 10).map((group) => (
              <article className="history-group" key={group.id}>
                <div className="history-meta">
                  <time>{formatTimestamp(group.startedAtMs)}</time>
                  {group.revised ? <span>已修订</span> : null}
                </div>
                <p className="history-source">{group.sourceText}</p>
                <p className="history-translation">{group.translatedText}</p>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <button type="button" className="history-collapsed-bar" onClick={() => setHistoryExpanded(true)}>
          <span>字幕历史</span>
          <span>{historyGroups.length > 0 ? `${historyGroups.length} 段` : ""}</span>
          <ChevronUp size={18} aria-hidden="true" />
        </button>
      )}
    </main>
  );

}
