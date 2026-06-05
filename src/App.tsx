export function App() {
  const appInfo = window.simultaneousInterpretation;

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="intro-panel">
        <p className="eyebrow">Desktop AI Interpreter</p>
        <h1 id="app-title">Simultaneous Interpretation</h1>
        <p className="lede">
          Project scaffold is ready. The next PR will turn this window into the
          real-time interpretation workbench.
        </p>
        <dl className="status-grid" aria-label="Application scaffold status">
          <div>
            <dt>Desktop shell</dt>
            <dd>Electron</dd>
          </div>
          <div>
            <dt>Renderer</dt>
            <dd>React + Vite</dd>
          </div>
          <div>
            <dt>Language</dt>
            <dd>TypeScript</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{appInfo?.version ?? "0.1.0"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
