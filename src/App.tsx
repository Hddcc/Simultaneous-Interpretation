import { useEffect, useMemo, useRef, useState } from "react";
import { createSimulatedChunk, formatTimestamp } from "./audio/simulator";
import type {
  AudioSessionState,
  AudioSourceOption,
  AudioSourceType,
  LocalMediaFile,
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
    description: "用于外放会议或现场环境声的备用输入。"
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

export function App() {
  const appInfo = window.simultaneousInterpretation;
  const [session, setSession] = useState<AudioSessionState>(initialSession);
  const [languageDirection, setLanguageDirection] = useState(languageOptions[0]);
  const [recentChunks, setRecentChunks] = useState<NormalizedAudioChunk[]>([]);
  const chunkSequenceRef = useRef(0);

  const selectedSource = useMemo(
    () => sourceOptions.find((option) => option.type === session.sourceType) ?? sourceOptions[0],
    [session.sourceType]
  );

  useEffect(() => {
    if (session.status !== "streaming" || session.sourceType !== "file") {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const chunk = createSimulatedChunk(
        "file",
        chunkSequenceRef.current,
        session.selectedFile
      );
      chunkSequenceRef.current += 1;

      setSession((current) => ({
        ...current,
        lastChunk: chunk,
        chunksProduced: current.chunksProduced + 1,
        volume: chunk.volume,
        error: null
      }));
      setRecentChunks((current) => [chunk, ...current].slice(0, 5));
    }, 500);

    return () => window.clearInterval(timer);
  }, [session.selectedFile, session.sourceType, session.status]);

  function updateSourceType(type: AudioSourceType): void {
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

  async function selectLocalFile(): Promise<void> {
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

  function startSession(): void {
    if (session.sourceType === "file") {
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

    setSession((current) => ({
      ...current,
      status: "ready",
      error:
        current.sourceType === "microphone"
          ? "麦克风真实采集将在 PR 4 接入，当前只完成输入源选择。"
          : "系统音频真实采集将在 PR 5 接入，当前只完成输入源选择。"
    }));
  }

  function pauseSession(): void {
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

          <button type="button" className="primary-action" onClick={startSession}>
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
              {session.status === "streaming" ? "模拟输入中" : "等待输入"}
            </span>
          </div>

          <div className="caption-stage" aria-live="polite">
            <p className="source-caption">{selectedSource.description}</p>
            <p className="translated-caption">
              {session.sourceType === "file" && session.selectedFile
                ? `已选择 ${session.selectedFile.name}`
                : "选择音频源后，可先用文件模拟验证实时输入链路。"}
            </p>
            {session.error ? <p className="error-message">{session.error}</p> : null}
          </div>

          <div className="source-actions" aria-label="音频源操作">
            <button type="button" className="secondary-action" onClick={selectLocalFile}>
              选择本地文件
            </button>
            <div className="volume-meter" aria-label="音量活动">
              <span style={{ width: `${Math.round(session.volume * 100)}%` }} />
            </div>
          </div>

          <div className="placeholder-row" aria-label="输入源状态">
            <span>统一音频块：16 kHz / mono / 500 ms</span>
            <span>
              {session.selectedFile
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
                <p className="history-translation">开始文件模拟后，这里会显示实时 chunk 元数据。</p>
              </article>
            ) : (
              recentChunks.map((chunk) => (
                <article className="history-item" key={chunk.id}>
                  <div className="history-meta">
                    <time>{formatTimestamp(chunk.timestampMs)}</time>
                    <span>#{chunk.sequence + 1}</span>
                  </div>
                  <p className="history-source">
                    {chunk.fileName ?? getSourceLabel(chunk.sourceType)}
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
