# Simultaneous Interpretation

Desktop AI simultaneous interpretation assistant for real-time bilingual captions.

## Current Status

PR 1 establishes the project scaffold:

- Electron desktop shell
- React renderer powered by Vite
- TypeScript configuration
- Environment variable sample
- OpenSpec-driven PR task plan

Feature implementation will continue in separate PR-sized steps so the repository keeps a clear development history.

## Planned Capabilities

- Capture computer/system audio, microphone input, and local file playback.
- Stream audio through ASR and translation services.
- Support English to Chinese and Chinese to English in the first version.
- Revise recent subtitles in place when recognition or translation improves.
- Provide a main workbench and a floating caption window.
- Add optional translated speech output after subtitles are stable.

## Development Setup

Prerequisites:

- Node.js 20 or newer
- npm

Install dependencies:

```bash
npm install
```

Run the desktop app in development:

```bash
npm run dev
```

Build and run the packaged-output flow locally:

```bash
npm run build
npm start
```

If Electron starts as plain Node in a custom terminal environment, clear `ELECTRON_RUN_AS_NODE` before launching the app.

## Environment Variables

Copy `.env.example` to `.env` and fill in local API keys when AI integration PRs begin.

```bash
copy .env.example .env
```

Do not commit real secrets.

## Delivery Workflow

Implementation follows the OpenSpec tasks under:

```text
openspec/changes/add-desktop-simultaneous-interpretation/tasks.md
```

Each PR should implement one task group only, include a clear PR description, and keep `main` runnable after merge.

## Third-Party Dependencies

Initial scaffold dependencies:

- Electron: desktop application shell
- React: renderer UI framework
- Vite: frontend development and build tooling
- TypeScript: static typing
- concurrently and wait-on: local development process orchestration

Original implementation currently includes project structure, Electron window setup, preload bridge, React entry point, scaffold UI, OpenSpec proposal, design, specs, and task plan.
