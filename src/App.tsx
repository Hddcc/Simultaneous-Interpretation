import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCapturedMicrophoneChunk,
  createSimulatedChunk,
  formatTimestamp
} from "./audio/simulator";
import type {
  AudioSessionState,
  AudioSourceOption,
  AudioSourceType,
  LocalMediaFile,
  MicrophoneDevice,
  NormalizedAudioChunk
} from "./audio/types";

const sourceOptions: AudioSourceOption[] = [
  {
    type: "system",
    label: "系统音频",
    description: "面向会议、网课、播放器等电脑正在播放的声音。"
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

export function App() {
  const appInfo = window.simultaneousInterpretation;
  const [session, setSession] = useState<AudioSessionState>(initialSession);
  const [languageDirection, setLanguageDirection] = useState(languageOptions[0]);
  const [recentChunks, setRecentChunks] = useState<NormalizedAudioChunk[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");

  const chunkSequenceRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const microphoneTimerRef = useRef<number | null>(null);

  const selectedSource = useMemo(
    () => sourceOptions.find((option) => option.type === session.sourceType) ?? sourceOptions[0],
    [session.sourceType]
  );

  const selectedMicrophoneLabel =
    microphoneDevices.find((device) => device.deviceId === selectedMicrophoneId)?.label ??
    "默认麦克风";

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
      cleanupMicrophoneCapture();
    };
  }, []);

  function recordChunk(chunk: NormalizedAudioChunk): void {
    setSession((current) => ({
      ...current,
      lastChunk: chunk,
      chunksProduced: current.chunksProduced + 1,
      volume: chunk.volume,
      error: null
    }));
    setRecentChunks((current) => [chunk, ...current].slice(0, 5));
  }

  function resetInputState(type: AudioSourceType): void {
    chunkSequenceRef.current = 0;
    setRecentChunks([]);
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

  function cleanupMicrophoneCapture(): void {
    if (microphoneTimerRef.current !== null) {
      window.clearInterval(microphoneTimerRef.current);
      microphoneTimerRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }

  function updateSourceType(type: AudioSourceType): void {
    cleanupMicrophoneCapture();
    resetInputState(type);

    if (type === "microphone" && microphoneDevices.length === 0) {
      void refreshMicrophoneDevices();
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
      cleanupMicrophoneCapture();
      chunkSequenceRef.current = 0;
      setRecentChunks([]);

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

      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;

      setSession((current) => ({
        ...current,
        sourceType: "microphone",
        status: "streaming",
        lastChunk: null,
        chunksProduced: 0,
        volume: 0,
        error: null
      }));

      microphoneTimerRef.current = window.setInterval(() => {
        const volume = getVolumeFromAnalyser(analyser);
        const chunk = createCapturedMicrophoneChunk(
          chunkSequenceRef.current,
          volume,
          selectedMicrophoneLabel
        );
        chunkSequenceRef.current += 1;
        recordChunk(chunk);
      }, 500);
    } catch (error) {
      cleanupMicrophoneCapture();
      setSession((current) => ({
        ...current,
        sourceType: "microphone",
        status: "error",
        volume: 0,
        error: error instanceof Error ? error.message : "麦克风启动失败。"
      }));
    }
  }

  async function selectLocalFile(): Promise<void> {
    cleanupMicrophoneCapture();

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
    if (session.sourceType === "microphone") {
      await startMicrophoneCapture();
      return;
    }

    if (session.sourceType === "file") {
      cleanupMicrophoneCapture();

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
      return;
    }

    cleanupMicrophoneCapture();
    setSession((current) => ({
      ...current,
      status: "ready",
      error: "系统音频真实采集将在下一阶段接入，当前已完成输入源选择。"
    }));
  }

  function pauseSession(): void {
    if (session.sourceType === "microphone") {
      cleanupMicrophoneCapture();
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
            <p className="source-caption">{selectedSource.description}</p>
            <p className="translated-caption">
              {session.sourceType === "microphone"
                ? `当前设备：${selectedMicrophoneLabel}`
                : session.sourceType === "file" && session.selectedFile
                  ? `已选择 ${session.selectedFile.name}`
                  : "选择音频源后，可先用文件模拟或麦克风验证实时输入链路。"}
            </p>
            {session.error ? <p className="error-message">{session.error}</p> : null}
          </div>

          <div className="source-actions" aria-label="音频源操作">
            {session.sourceType === "microphone" ? (
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
              {session.sourceType === "microphone"
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
            {recentChunks.length === 0 ? (
              <article className="history-item">
                <div className="history-meta">
                  <time>--:--</time>
                  <span>等待</span>
                </div>
                <p className="history-source">暂无音频块</p>
                <p className="history-translation">
                  开始文件模拟或麦克风采集后，这里会显示实时 chunk 元数据。
                </p>
              </article>
            ) : (
              recentChunks.map((chunk) => (
                <article className="history-item" key={chunk.id}>
                  <div className="history-meta">
                    <time>{formatTimestamp(chunk.timestampMs)}</time>
                    <span>#{chunk.sequence + 1}</span>
                  </div>
                  <p className="history-source">
                    {chunk.fileName ?? chunk.deviceLabel ?? getSourceLabel(chunk.sourceType)}
                  </p>
                  <p className="history-translation">
                    {chunk.durationMs} ms · {chunk.sampleRate} Hz · 音量{" "}
                    {Math.round(chunk.volume * 100)}%
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
