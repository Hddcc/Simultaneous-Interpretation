## Context

The current application has a polished Electron/React workbench, source selection, microphone and desktop source entry points, mock streaming ASR, mock bilingual translation, revision-aware subtitles, floating captions, optional local TTS, and OpenAI-backed file transcription plus translation. That proves the UI and data model, but it does not yet satisfy the core live desktop interpretation scenario: users should be able to open the app while watching a browser video, joining a Tencent Meeting, or using WeChat voice/video calls and receive low-latency translated captions from the real computer playback audio.

The existing Electron desktop capture path can enumerate screen/window sources, but relying only on Chromium desktop capture is not reliable enough for Windows playback audio from arbitrary apps. The complete project needs a Windows-first system audio loopback path, audio payload chunks, realtime provider sessions, and scenario verification.

## Goals / Non-Goals

**Goals:**

- Capture real Windows system playback audio from browser, meeting, player, and call scenarios.
- Preserve microphone and file simulation as supported secondary sources.
- Produce real audio payload chunks suitable for realtime ASR.
- Stream audio to a provider-backed ASR session and receive partial/final events.
- Translate stable or sufficiently confident text with recent context and provider status.
- Update subtitles in place when ASR or translation corrections arrive.
- Keep floating captions usable above other apps during live interpretation.
- Keep each implementation step as a separate PR-sized task group.
- Keep README public-facing, Chinese, product-style, and free of internal PR/task checklist language.

**Non-Goals:**

- Full offline ASR or translation model hosting.
- Perfect capture support across every operating system in this change; Windows is the first complete target.
- Multi-speaker diarization as a required feature.
- Production billing/account management.
- Fully replacing the existing mock/file demo paths.

## Decisions

### Windows loopback helper for system audio

Use a Windows-first helper layer for system playback capture, preferably WASAPI loopback. The helper may be implemented as a Node native addon, small local executable, or tightly scoped helper process. Electron remains the app shell, while the helper provides reliable PCM frames from the default output device.

Alternative considered: continue using only Electron `desktopCapturer`. That path is simpler and already exists, but it is inconsistent for meeting apps, call apps, and arbitrary playback audio. It remains a fallback/source enumeration path.

### Real audio chunk contract

Extend the existing normalized chunk contract so each captured chunk can carry audio payload metadata and provider-ready bytes. The app should support 100-500 ms chunk durations, monotonic sequence numbers, timestamps, sample rate, channel count, encoding, source type, and volume.

The UI can continue rendering volume and chunk status, while provider clients consume the payload stream. File simulation can still emit timed chunks, but real capture chunks must contain audio data or a reference to encoded audio data.

### Provider session abstraction

Create a provider session interface for realtime ASR and translation:

```text
AudioSource -> AudioChunkQueue -> RealtimeAsrSession -> TranslationSession -> SubtitleStore
```

The session abstraction should model lifecycle states:

```text
idle -> connecting -> streaming -> reconnecting -> closing -> closed
                         │
                         ▼
                       error
```

OpenAI Realtime transcription is the default complete path. Translation should use OpenAI by default and allow DeepSeek-compatible text models for translation-only use. DeepSeek can translate recognized text but cannot replace ASR by itself.

### Backpressure and recovery

The app should keep bounded queues for captured audio chunks. When network or provider latency grows, the UI should show degraded status and the queue should avoid unbounded memory growth. Recoverable provider errors should stop or reconnect the session without freezing source selection controls.

### Correction model

ASR partial events create or update interim source text. ASR final events stabilize source text. Translation can first publish a quick draft and later revise wording when context improves. Existing subtitle IDs and revision numbers remain the core reconciliation mechanism.

### README style

README updates should explain what a user can do, how to configure providers, how to start the app, and which live scenarios are supported. README should avoid internal artifact language such as PR numbers, task numbers, private demo instructions, or submission checklist phrasing.

## Risks / Trade-offs

- Windows loopback helper adds platform-specific complexity -> keep the helper isolated and expose a narrow IPC contract.
- Native build tooling may be fragile on reviewers' machines -> provide fallback to existing Electron desktop capture and microphone/file simulation.
- Realtime ASR can be costly and latency-sensitive -> display provider status, queue depth, and degraded states.
- Provider APIs may change -> centralize provider code behind interfaces and keep `.env.example` explicit.
- Tencent Meeting or WeChat may block/alter audio capture in some setups -> define scenario verification with fallback notes and capture diagnostics.
- Frequent revisions can distract users -> keep the recent revision window and subtle visual indicators.

## Migration Plan

1. Add the native/helper audio capture path behind a feature flag or source capability check.
2. Extend the audio chunk model to include provider-ready payloads while keeping existing mock paths working.
3. Add realtime ASR session plumbing and connect system/microphone sources.
4. Add provider-backed translation and correction handling.
5. Add live scenario status and verification notes.
6. Update README only after the live path is usable, keeping the public product style.

Rollback for any PR is a standard Git revert of that PR. The existing mock/file workflow should remain available throughout the migration.

## Open Questions

- Should the first helper be a Node native addon, a small Go/Rust executable, or an npm library wrapper around WASAPI loopback?
- Which provider should be the first complete realtime path: OpenAI Realtime transcription only, or OpenAI ASR plus DeepSeek translation as an optional second provider?
- What exact Tencent Meeting and WeChat test setup is available on the development machine?
- Should translated speech output use local Web Speech for the complete demo or a cloud TTS provider?
