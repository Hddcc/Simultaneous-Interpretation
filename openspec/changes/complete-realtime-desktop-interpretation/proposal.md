## Why

The current app is a strong desktop MVP, but it still does not fulfill the core user promise: opening the app while watching a browser video, joining a meeting, or taking a WeChat call should produce live translated captions from the computer's actual playback audio.

This change turns the project from a UI/demo pipeline with file-based real API verification into a complete realtime desktop interpretation workflow with reliable audio capture, true streaming ASR, streaming translation, correction, and scenario-level verification.

## What Changes

- Add a reliable Windows-first system playback capture path for browser, meeting, player, and call audio.
- Capture microphone and system playback audio as real encoded chunks that can be sent to a provider, rather than metadata-only simulated chunks.
- Add a realtime ASR provider session that streams audio chunks and receives partial/final recognition events.
- Add streaming translation using configurable providers, with OpenAI as the default complete path and DeepSeek-compatible text translation as an optional translation provider.
- Preserve the existing revision-aware subtitle model while grounding revisions in real ASR/translation updates.
- Add provider health, connection, latency, recovery, and cost-risk states to the desktop workbench.
- Add scenario verification for browser video, meeting software, WeChat/call-style audio, microphone fallback, floating captions, and optional speech output.
- Keep implementation split into small PR-sized work units, with one coherent feature per PR.
- Keep README updates in Chinese product-usage style: public usage, configuration, startup, supported scenarios, known limitations, and troubleshooting; no internal PR numbering or private submission checklist language.

## Capabilities

### New Capabilities

- `native-system-audio-capture`: Captures real Windows system playback audio through a native or helper-based loopback path and exposes it to the Electron app.
- `realtime-provider-sessions`: Manages realtime ASR and translation provider sessions, including connection lifecycle, streaming payloads, errors, retries, and provider status.
- `desktop-scenario-verification`: Defines end-to-end verification requirements for browser videos, meeting apps, call apps, microphone fallback, floating subtitles, and README-visible user flows.

### Modified Capabilities

- `desktop-audio-ingestion`: Require captured sources to produce real audio payloads suitable for realtime ASR, not only normalized metadata.
- `realtime-interpretation-pipeline`: Require true provider-backed streaming ASR and translation for live system/microphone audio, while preserving file simulation as a secondary test path.
- `revision-aware-subtitles`: Require corrections to be driven by real provider partial/final updates and translation revisions.
- `desktop-caption-experience`: Require visible realtime connection, latency, capture, and recovery states for complete live-use scenarios.
- `project-delivery-workflow`: Require the complete project to remain PR-sized, continuously verifiable, README product-style, and public-submission friendly.

## Impact

- Adds a native/helper capture component or equivalent Windows loopback integration.
- Adds audio payload encoding, chunk buffering, queue backpressure, and session lifecycle code.
- Adds provider integration for realtime ASR and streaming/near-streaming translation.
- Extends existing Electron IPC and preload APIs for audio chunks, provider session control, and health status.
- Updates React workbench state to distinguish mock, file transcription, and true realtime interpretation.
- Updates README and `.env.example` to describe real API configuration and live desktop use without exposing secrets.
- Adds PR descriptions and verification notes for each new functional slice.
