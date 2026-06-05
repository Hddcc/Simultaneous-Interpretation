import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCapturedMicrophoneChunk,
  createCapturedSystemAudioChunk,
  createSimulatedChunk,
  formatTimestamp
} from "./audio/simulator";
import { createStreamingAsrClient } from "./asr/client";
import { loadAsrConfig } from "./asr/config";
import type { AsrEvent, AsrSegment } from "./asr/types";
import type {
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

const languageOptions = ["英语 -> 中文", "中文 -> 英语"];

const initialSession: AudioSessionState = {
  sourceType: "system",
  status: "idle",
  selectedFile: null,
  lastChunk: null,
  chunksProduced: 0,
  volume: 0,
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

function getVolumeFromAnalyser(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);

  let sum = 0;
  for (const sample of samples) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }

  return Math.min(1, Math.sqrt(sum / samples.length) * 3);
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
  const [session, setSession] = useState<AudioSessionState>(initialSession);
  const [languageDirection, setLanguageDirection] = useState(languageOptions[0]);
  const [recentChunks, setRecentChunks] = useState<NormalizedAudioChunk[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [desktopSources, setDesktopSources] = useState<DesktopAudioSource[]>([]);
  const [selectedDesktopSourceId, setSelectedDesktopSourceId] = useState("");
  const [asrEvents, setAsrEvents] = useState<AsrEvent[]>([]);
  const [asrSegments, setAsrSegments] = useState<AsrSegment[]>([]);

  const chunkSequenceRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const languageDirectionRef = useRef(languageDirection);
  const asrClientRef = useRef(createStreamingAsrClient(loadAsrConfig()));

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
  const asrConfig = asrClientRef.current.getConfig();

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
    languageDirectionRef.current = languageDirection;
  }, [languageDirection]);

  function recordChunk(chunk: NormalizedAudioChunk): void {
    setSession((current) => ({
      ...current,
      lastChunk: chunk,
      chunksProduced: current.chunksProduced + 1,
      volume: chunk.volume,
      error: null
    }));
    setRecentChunks((current) => [chunk, ...current].slice(0, 5));
    publishAsrEvents(chunk);
  }

  function publishAsrEvents(chunk: NormalizedAudioChunk): void {
    const nextEvents = asrClientRef.current.pushChunk(chunk, languageDirectionRef.current);

    if (nextEvents.length === 0) {
      return;
    }

    setAsrEvents((current) => [...nextEvents, ...current].slice(0, 8));
    setAsrSegments((current) => {
      const byId = new Map(current.map((segment) => [segment.id, segment]));

      nextEvents.forEach((event) => {
        byId.set(event.segmentId, {
          id: event.segmentId,
          sourceType: event.sourceType,
          text: event.text,
          status: event.status,
          startedAtMs: event.audioStartMs,
          endedAtMs: event.audioEndMs,
          updatedAtMs: event.receivedAtMs,
          latencyMs: event.latencyMs,
          revision: event.revision
        });
      });

      return Array.from(byId.values())
        .sort((left, right) => right.startedAtMs - left.startedAtMs)
        .slice(0, 6);
    });
  }

  function resetAsrState(): void {
    asrClientRef.current.reset();
    setAsrEvents([]);
    setAsrSegments([]);
  }

  function resetInputState(type: AudioSourceType): void {
    chunkSequenceRef.current = 0;
    setRecentChunks([]);
    resetAsrState();
    setSession((current) => ({
      ...current,
      sourceType: type,
      status: type === "file" && current.selectedFile ? "ready" : "idle",
      lastChunk: null,
      chunksProduced: 0,
      volume: 0,
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

    setSession((current) => ({
      ...current,
      sourceType,
      status: "streaming",
      lastChunk: null,
      chunksProduced: 0,
      volume: 0,
      error: null
    }));

    captureTimerRef.current = window.setInterval(() => {
      const volume = getVolumeFromAnalyser(analyser);
      const chunk =
        sourceType === "microphone"
          ? createCapturedMicrophoneChunk(chunkSequenceRef.current, volume, sourceLabel)
          : createCapturedSystemAudioChunk(chunkSequenceRef.current, volume, sourceLabel);
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
      error: null
    }));
  }

  async function startSession(): Promise<void> {
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

  const metrics = [
    { label: "音频源", value: getSourceLabel(session.sourceType) },
    { label: "输入状态", value: session.status },
    { label: "音频块", value: String(session.chunksProduced) },
    { label: "ASR", value: `${asrConfig.provider}/${asrConfig.model}` },
    {
      label: "识别延迟",
      value: latestAsrEvent ? `${latestAsrEvent.latencyMs} ms` : "等待识别"
    },
    { label: "音量", value: `${Math.round(session.volume * 100)}%` },
    { label: "语言方向", value: languageDirection }
  ];

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <header className="top-bar" aria-label="同声传译控制区">
        <div className="brand-block">
          <p className="eyebrow">AI 同声传译助手</p>
          <h1 id="app-title">Simultaneous Interpretation</h1>
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
              value={languageDirection}
              aria-label="选择语言方向"
              onChange={(event) => setLanguageDirection(event.target.value)}
            >
              {languageOptions.map((option) => (
                <option key={option}>{option}</option>
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
              {latestAsrSegment
                ? latestAsrSegment.status === "final"
                  ? "原文识别已确认"
                  : "原文识别更新中"
                : selectedSource.description}
            </p>
            <p className="translated-caption asr-caption">
              {latestAsrSegment
                ? latestAsrSegment.text
                : session.sourceType === "system"
                  ? `当前来源：${selectedDesktopSourceName}`
                  : session.sourceType === "microphone"
                    ? `当前设备：${selectedMicrophoneLabel}`
                    : session.selectedFile
                      ? `已选择 ${session.selectedFile.name}`
                      : "选择音频源后，可先用文件模拟、麦克风或系统音频验证实时输入链路。"}
            </p>
            {latestAsrSegment ? (
              <div className="asr-detail-row" aria-label="识别事件状态">
                <span>{latestAsrSegment.status === "final" ? "Final" : "Partial"}</span>
                <span>片段 {latestAsrSegment.id.replace("asr-segment-", "#")}</span>
                <span>版本 {latestAsrSegment.revision}</span>
                <span>{latestAsrSegment.latencyMs} ms</span>
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

          <div className="placeholder-row" aria-label="输入源状态">
            <span>统一音频块：16 kHz / mono / 500 ms</span>
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
                ? `最近时间戳 ${formatTimestamp(session.lastChunk.timestampMs)}`
                : "等待首个音频块"}
            </span>
          </div>
        </section>

        <aside className="history-panel" aria-labelledby="history-title">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Chunks</p>
              <h2 id="history-title">输入记录</h2>
            </div>
            <span className="small-version">v{appInfo?.version ?? "0.1.0"}</span>
          </div>

          <div className="history-list">
            {asrSegments.length === 0 ? (
              <article className="history-item">
                <div className="history-meta">
                  <time>--:--</time>
                  <span>等待</span>
                </div>
                <p className="history-source">暂无识别文本</p>
                <p className="history-translation">
                  开始文件模拟、麦克风或系统音频采集后，这里会显示实时 ASR 片段。
                </p>
              </article>
            ) : (
              asrSegments.map((segment) => (
                <article className="history-item" key={segment.id}>
                  <div className="history-meta">
                    <time>{formatTimestamp(segment.startedAtMs)}</time>
                    <span>{segment.status === "final" ? "Final" : "Partial"}</span>
                  </div>
                  <p className="history-source">{segment.text}</p>
                  <p className="history-translation">
                    {getSourceLabel(segment.sourceType)} · 版本 {segment.revision} · 延迟{" "}
                    {segment.latencyMs} ms
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
