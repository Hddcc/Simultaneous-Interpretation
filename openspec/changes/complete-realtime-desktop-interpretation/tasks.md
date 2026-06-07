## 1. PR 1 - Live Audio Architecture and Capture Spike

- [x] 1.1 Audit the current Electron audio capture, mock ASR, file transcription, and translation flow to identify reusable integration points.
- [x] 1.2 Choose the first Windows system playback capture approach, documenting whether it uses WASAPI loopback helper, native addon, or a local helper executable.
- [x] 1.3 Add a minimal capture spike that can detect helper availability and report system playback capture capability without changing the main user flow.
- [x] 1.4 Verify the app still builds and the existing mock/file flows continue to run.
- [x] 1.5 Prepare a PR description focused only on the architecture decision and capture spike.

## 2. PR 2 - Real Audio Payload Chunk Contract

- [x] 2.1 Extend the normalized audio chunk model with provider-ready payload metadata, encoding, sample format, queue status, and payload availability.
- [x] 2.2 Convert microphone capture into real short audio payload chunks suitable for realtime ASR streaming.
- [x] 2.3 Convert the selected system playback capture path into the same payload chunk contract.
- [x] 2.4 Add bounded chunk queue state, dropped-chunk accounting, and volume/latency metadata.
- [x] 2.5 Prepare a PR description focused only on the real audio payload contract.

## 3. PR 3 - Realtime Provider Configuration and Session Shell

- [x] 3.1 Add `.env.example` entries for realtime ASR provider, translation provider, model names, base URLs, and optional DeepSeek translation configuration.
- [x] 3.2 Move provider secrets and realtime session creation into Electron main process or another local-only runtime boundary.
- [x] 3.3 Add IPC/preload APIs for provider health, session start, session stop, and provider configuration status.
- [x] 3.4 Add workbench status indicators for provider mode, API key presence, connection state, queue depth, and recoverable errors.
- [x] 3.5 Prepare a PR description focused only on provider configuration and session lifecycle shell.

## 4. PR 4 - Realtime ASR Streaming

- [x] 4.1 Implement the realtime ASR session client for live audio chunks using the selected provider path.
- [x] 4.2 Stream microphone audio chunks to ASR and emit partial/final recognition events with stable segment IDs.
- [x] 4.3 Stream system playback audio chunks to ASR and emit partial/final recognition events without requiring file upload.
- [x] 4.4 Add retry, stop, timeout, and missing-key behavior for ASR sessions.
- [x] 4.5 Prepare a PR description focused only on realtime ASR streaming.

## 5. PR 5 - Provider Translation and Context

- [x] 5.1 Implement provider-backed translation for stable ASR segments using recent source/target context.
- [x] 5.2 Support OpenAI as the default translation path and DeepSeek-compatible text translation as an optional translation provider.
- [x] 5.3 Add translation error handling that keeps source text visible when translation fails.
- [x] 5.4 Display ASR latency, translation latency, total latency, and provider model labels in the workbench.
- [x] 5.5 Prepare a PR description focused only on provider translation and context.

## 6. PR 6 - Realtime Subtitle Revision Reconciliation

- [x] 6.1 Reconcile realtime ASR partial/final events with existing subtitle segment IDs and revision numbers.
- [x] 6.2 Apply translation revisions in place when final ASR or improved translation output supersedes earlier text.
- [x] 6.3 Record revision provenance such as ASR partial correction, ASR finalization, translation correction, reconnect, or fallback.
- [x] 6.4 Verify old subtitles outside the revision window remain stable while recent subtitles can update.
- [x] 6.5 Prepare a PR description focused only on realtime subtitle correction.

## 7. PR 7 - Live Desktop Experience and Recovery UI

- [ ] 7.1 Add workbench states for live capture, provider connecting, streaming, reconnecting, degraded, error, and stopped.
- [ ] 7.2 Keep source selection, stop, fallback, and retry controls usable during capture/provider errors.
- [ ] 7.3 Update the floating caption window to show latest subtitle plus compact live/degraded/reconnecting status.
- [ ] 7.4 Verify text, controls, and latency indicators remain readable across common desktop window sizes.
- [ ] 7.5 Prepare a PR description focused only on live desktop experience and recovery UI.

## 8. PR 8 - Desktop Scenario Verification

- [ ] 8.1 Verify browser video playback can produce live translated captions from system audio without file upload.
- [ ] 8.2 Verify Tencent Meeting or comparable meeting app audio can be captured or produces a clear documented fallback.
- [ ] 8.3 Verify WeChat or comparable call-style audio can be captured or produces a clear documented fallback.
- [ ] 8.4 Verify microphone fallback, floating captions over other apps, and optional translated speech output in live mode.
- [ ] 8.5 Prepare a PR description focused only on real desktop scenario verification.

## 9. PR 9 - README Product Usage Update

- [ ] 9.1 Rewrite README configuration and usage sections in Chinese product-usage style for realtime desktop interpretation.
- [ ] 9.2 Document required API keys, provider choices, model roles, Windows system audio setup, startup commands, and troubleshooting.
- [ ] 9.3 Document supported scenarios and known limitations based on verification results, without internal PR/task checklist language.
- [ ] 9.4 Update dependency and original implementation attribution for the capture helper and provider APIs.
- [ ] 9.5 Prepare a PR description focused only on README and public usage documentation.

## 10. PR 10 - Final Verification and Archive

- [ ] 10.1 Run build, Electron smoke test, OpenSpec validation, and scenario verification checklist.
- [ ] 10.2 Confirm no real API keys, local-only files, helper build artifacts, or generated junk files are committed.
- [ ] 10.3 Confirm `main` is runnable and pushed to the public GitHub repository.
- [ ] 10.4 Prepare final release or PR note summarizing complete realtime interpretation status and limitations.
- [ ] 10.5 Archive the OpenSpec change after all tasks and specs are complete.
