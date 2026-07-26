## 1. Aliyun Provider Configuration

- [x] 1.1 Extend provider types to include `aliyun` for realtime ASR and translation.
- [x] 1.2 Add `DASHSCOPE_API_KEY`, Aliyun ASR defaults, Qwen translation defaults, and one-key missing-config checks in Electron main/provider runtime config.
- [x] 1.3 Update preload/global types and workbench provider labels so Aliyun mode displays clearly without exposing secrets to the renderer.
- [x] 1.4 Add configuration tests or focused runtime checks for Aliyun single-key, missing-key, mock, OpenAI, DeepSeek, and custom modes.

## 2. fun-asr-realtime ASR Streaming

- [x] 2.1 Implement an Aliyun DashScope WebSocket session client for `fun-asr-realtime` in the Electron main process.
- [x] 2.2 Send live PCM audio chunks from microphone and system audio to the Aliyun ASR session using the provider-ready audio payload contract.
- [x] 2.3 Parse Aliyun ASR partial and final events into existing `RealtimeProviderAsrEvent` objects with stable segment IDs and latency metadata.
- [x] 2.4 Handle Aliyun session start, stop, timeout, close, provider error, missing key, and reconnect/degraded states without freezing fallback controls.
- [x] 2.5 Add event-mapping tests using representative Aliyun ASR event fixtures.

## 3. Qwen Translation With The Same Key

- [x] 3.1 Implement `TRANSLATION_PROVIDER=aliyun` using DashScope OpenAI-compatible chat completions and Qwen models such as `qwen-plus`.
- [x] 3.2 Reuse `DASHSCOPE_API_KEY` for Aliyun translation while preserving optional custom provider configuration.
- [x] 3.3 Preserve recent context, language direction, latency tracking, provider/model metadata, and source-text fallback behavior for Qwen translations.
- [x] 3.4 Add translation request construction and error-handling tests for Aliyun/Qwen mode.

## 4. Product Usage And Configuration

- [x] 4.1 Update `.env.example` so the first real-use example is the one-key Aliyun setup.
- [x] 4.2 Update README in Chinese product-usage style, explaining that one Model Studio API key can run `fun-asr-realtime` ASR and Qwen translation when the account has access.
- [x] 4.3 Update dependency/originality and verification docs to mention DashScope realtime ASR, Qwen translation, and `DASHSCOPE_API_KEY` secret hygiene.
- [x] 4.4 Keep OpenAI, DeepSeek, custom, and mock documentation as secondary options.

## 5. End-to-End Verification

- [x] 5.1 Run build, OpenSpec validation, provider configuration tests, ASR event mapping tests, translation tests, subtitle revision tests, live state tests, and desktop scenario tests.
- [x] 5.2 Run Electron smoke test in Aliyun-configured mode without committing real `.env` values.
- [x] 5.3 Scan for real API keys and confirm only placeholders or variable names appear in tracked files.
- [x] 5.4 Prepare a single implementation PR description summarizing Aliyun one-key realtime ASR, Qwen translation, setup steps, verification, and known limitations.
