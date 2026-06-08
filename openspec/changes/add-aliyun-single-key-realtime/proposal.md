## Why

Users who already have an Alibaba Cloud Model Studio / DashScope key should be able to run the project with real realtime interpretation using one local key, instead of falling back to mock ASR or needing separate OpenAI and DeepSeek credentials.

This change makes the first recommended real-use path: one `DASHSCOPE_API_KEY` for `fun-asr-realtime` speech recognition and Qwen text translation.

## What Changes

- Add Alibaba Cloud DashScope / Model Studio as a first-class realtime provider path.
- Support `fun-asr-realtime` WebSocket ASR for live system audio and microphone chunks.
- Support Qwen text translation through DashScope OpenAI-compatible API using the same key.
- Add a one-key configuration mode where `DASHSCOPE_API_KEY` is enough for ASR and translation.
- Keep OpenAI, DeepSeek, custom, and mock paths available as secondary options.
- Update provider health, missing-key messages, README, and `.env.example` so users can configure the real Aliyun path with minimal steps.
- Verify that real provider mode no longer requires mock ASR for users who configure DashScope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `realtime-provider-sessions`: Add Aliyun DashScope as a supported realtime ASR and translation provider, including one-key credential handling.
- `realtime-interpretation-pipeline`: Require live audio chunks to flow through `fun-asr-realtime` and Qwen translation when the Aliyun provider is selected.
- `desktop-audio-ingestion`: Require captured chunks to be transformed into the audio format accepted by DashScope realtime ASR.
- `project-delivery-workflow`: Update public usage documentation and verification expectations for the one-key Aliyun real-use path.

## Impact

- Affected runtime code: `electron/providerSession.ts`, `electron/main.ts`, `electron/preload.ts`, `types/preload.d.ts`, `src/App.tsx`, `src/translation/client.ts`, and provider-related types.
- Affected config/docs: `.env.example`, `README.md`, `docs/review/dependencies-and-originality.md`, and verification docs.
- New external APIs: DashScope WebSocket realtime inference endpoint for `fun-asr-realtime`, and DashScope OpenAI-compatible text endpoint for Qwen translation.
- Security impact: `DASHSCOPE_API_KEY` must remain in local `.env` and must never be exposed to the renderer bundle or committed.
