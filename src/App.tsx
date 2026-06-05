const sourceOptions = ["系统音频", "麦克风", "文件模拟"];
const languageOptions = ["英语 -> 中文", "中文 -> 英语"];

const historyItems = [
  {
    time: "00:00",
    source: "Waiting for incoming audio...",
    translation: "等待音频输入",
    state: "占位"
  },
  {
    time: "00:12",
    source: "Recent captions will appear here.",
    translation: "最近字幕会显示在这里",
    state: "历史"
  }
];

const metrics = [
  { label: "音频状态", value: "待连接" },
  { label: "ASR", value: "未启动" },
  { label: "翻译队列", value: "0" },
  { label: "延迟", value: "-- ms" },
  { label: "TTS", value: "关闭" }
];

export function App() {
  const appInfo = window.simultaneousInterpretation;

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
            <select defaultValue={sourceOptions[0]} aria-label="选择音频源">
              {sourceOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <label>
            <span>语言方向</span>
            <select defaultValue={languageOptions[0]} aria-label="选择语言方向">
              {languageOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>

          <button type="button" className="primary-action">
            开始
          </button>
          <button type="button" className="secondary-action">
            暂停
          </button>
        </form>
      </header>

      <section className="workspace-grid" aria-label="同传工作台">
        <section className="live-panel" aria-labelledby="live-caption-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">实时字幕</p>
              <h2 id="live-caption-title">等待输入音频</h2>
            </div>
            <span className="status-pill">服务待连接</span>
          </div>

          <div className="caption-stage" aria-live="polite">
            <p className="source-caption">
              Select an audio source and start a session. Live source text will
              stream here.
            </p>
            <p className="translated-caption">
              选择音频源并开始会话后，实时翻译字幕会显示在这里。
            </p>
          </div>

          <div className="placeholder-row" aria-label="字幕占位状态">
            <span>原文/译文双行显示</span>
            <span>支持后续修订状态</span>
            <span>悬浮字幕将在后续 PR 接入</span>
          </div>
        </section>

        <aside className="history-panel" aria-labelledby="history-title">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Session</p>
              <h2 id="history-title">历史记录</h2>
            </div>
            <span className="small-version">v{appInfo?.version ?? "0.1.0"}</span>
          </div>

          <div className="history-list">
            {historyItems.map((item) => (
              <article className="history-item" key={`${item.time}-${item.state}`}>
                <div className="history-meta">
                  <time>{item.time}</time>
                  <span>{item.state}</span>
                </div>
                <p className="history-source">{item.source}</p>
                <p className="history-translation">{item.translation}</p>
              </article>
            ))}
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
