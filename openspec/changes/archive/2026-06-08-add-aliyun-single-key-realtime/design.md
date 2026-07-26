## Context

The project already has realtime provider session plumbing, live audio chunk payloads, subtitle revision reconciliation, translation provider selection, provider health UI, and local `.env` secret loading in Electron main. However, the practical real-use path still leans on OpenAI for ASR and optionally DeepSeek for translation.

The user now has an Alibaba Cloud Model Studio / DashScope key and wants the minimum configuration needed to use the app with real data. Alibaba Cloud can cover both sides of the pipeline: `fun-asr-realtime` for speech recognition and Qwen text models such as `qwen-plus` for translation. The key is generated at the Model Studio business-space level and is selected at request time by model name.

Relevant official API shape to implement:

- Realtime ASR: DashScope WebSocket endpoint `wss://dashscope.aliyuncs.com/api-ws/v1/inference`.
- Authorization: `Authorization: Bearer <DASHSCOPE_API_KEY>`.
- ASR model: `fun-asr-realtime`.
- Text translation: DashScope OpenAI-compatible endpoint `https://dashscope.aliyuncs.com/compatible-mode/v1` with Qwen model such as `qwen-plus`.

## Goals / Non-Goals

**Goals:**

- Let a user run real live interpretation with only `DASHSCOPE_API_KEY` configured.
- Add `REALTIME_ASR_PROVIDER=aliyun` and `TRANSLATION_PROVIDER=aliyun`.
- Default Aliyun ASR model to `fun-asr-realtime`.
- Default Aliyun translation model to `qwen-plus`.
- Reuse the existing audio chunk, provider health, translation, subtitle revision, and floating caption pipeline.
- Keep OpenAI, DeepSeek, custom, and mock providers available.
- Update README and `.env.example` so the Aliyun single-key path is the first recommended real setup.

**Non-Goals:**

- Full support for every DashScope realtime or multimodal model.
- Offline ASR or local model hosting.
- Speaker diarization, punctuation tuning, or advanced ASR vocabulary customization in the first Aliyun pass.
- Replacing existing OpenAI or DeepSeek paths.
- Requiring multiple Alibaba Cloud credentials such as RAM AccessKey for this desktop app path.

## Decisions

### Use `DASHSCOPE_API_KEY` as the canonical one-key credential

The runtime will read `DASHSCOPE_API_KEY` for both Aliyun ASR and Aliyun translation. If translation code already accepts a custom key, it can fall back from `CUSTOM_TRANSLATION_API_KEY` to `DASHSCOPE_API_KEY` for Aliyun provider mode.

Alternative considered: reuse `CUSTOM_TRANSLATION_API_KEY` for all Aliyun calls. That keeps implementation small but makes the recommended setup less clear. A named `DASHSCOPE_API_KEY` matches the provider and reduces user confusion.

### Add explicit `aliyun` provider values

Provider types should include `aliyun` instead of using only `custom`. This lets the UI show a clear provider mode, lets missing-key messages name `DASHSCOPE_API_KEY`, and lets the runtime choose DashScope protocol-specific behavior.

Alternative considered: map Aliyun to `custom` and document base URLs. That still leaves ASR unsupported because `fun-asr-realtime` uses a provider-specific WebSocket event protocol, so explicit provider branching is clearer.

### Keep ASR protocol inside Electron main

The Aliyun WebSocket client should live in `electron/providerSession.ts`, alongside the existing OpenAI realtime session handling. Renderer code continues sending normalized PCM16/base64 audio chunks through IPC. The main process owns the API key, WebSocket, event mapping, and provider errors.

This preserves the current secret boundary and avoids exposing the DashScope key to the renderer bundle.

### Convert audio chunks for DashScope in the provider session

The current audio payload contract carries PCM16/base64 chunks with sample metadata. The Aliyun client should adapt those chunks into the format expected by `fun-asr-realtime`, including sample rate and encoding. If the provider requires 16 kHz mono PCM, the provider session should convert or reject with a readable error when conversion is not possible.

### Use Qwen through OpenAI-compatible text requests

Aliyun translation should use the DashScope OpenAI-compatible endpoint and send a translation-focused chat completion request using the selected language direction and recent context. The existing translation result model can remain unchanged.

## Risks / Trade-offs

- DashScope realtime ASR event protocol differs from OpenAI → implement a focused Aliyun event mapper with tests using sample event fixtures.
- Audio format mismatch can cause silent ASR failure → show sample rate/encoding in provider errors and keep mock/file fallback available.
- Network or quota issues may look like app failure → surface provider state, missing key, close code, and recoverable messages in the workbench.
- One key can access multiple models only when account permissions and quota are active → README must mention model access and billing prerequisites.
- Adding provider-specific code increases main-process complexity → keep Aliyun helpers isolated behind provider branches and small parsing functions.

## Migration Plan

1. Extend provider types and config parsing with `aliyun`, `DASHSCOPE_API_KEY`, DashScope base URLs, and default models.
2. Implement Aliyun realtime ASR WebSocket lifecycle in Electron main.
3. Map `fun-asr-realtime` partial/final events into existing `RealtimeProviderAsrEvent`.
4. Implement Aliyun/Qwen translation provider using the same `DASHSCOPE_API_KEY`.
5. Update UI labels, provider health, `.env.example`, README, and verification docs.
6. Add tests for config parsing, missing-key behavior, event mapping, and translation request construction.

Rollback is a normal revert of this change. Existing mock, OpenAI, DeepSeek, and custom paths remain available.
