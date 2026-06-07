# Add realtime ASR streaming

## 功能描述

本次变更把实时音频 payload 接入主进程 ASR streaming session。系统音频和麦克风 live capture 产生的 PCM16/base64 短块会发送到 Electron 主进程，由主进程持有 API key、建立 OpenAI Realtime transcription WebSocket，并把 provider partial/final ASR 事件回传到工作台。

默认 mock 配置仍然保留原有本地模拟 ASR；只有本地 `.env` 选择 realtime provider 时，live capture 才会走 provider streaming。

## 实现思路

- 在 `electron/providerSession.ts` 中实现 OpenAI realtime transcription WebSocket 客户端，连接时发送 `Authorization` 和 `OpenAI-Beta` 请求头。
- 将 renderer 采集到的 PCM16/base64 chunk 发送给主进程，主进程升采样到 24 kHz mono PCM 后通过 `input_audio_buffer.append` 推给 provider。
- 监听 `conversation.item.input_audio_transcription.delta` 和 `conversation.item.input_audio_transcription.completed`，生成稳定 segment ID、revision、latency 和 partial/final ASR 事件。
- 新增 `provider:append-audio-chunk` 和 `provider:pull-asr-events` IPC，让 renderer 可以推送音频并轮询异步 ASR 事件。
- 增加连接超时、缺 key 阻断、停止清理、断线一次重试和 `reconnecting` 状态。

## 测试方式

- 运行 `npm.cmd run build`，确认 renderer 与 Electron 主进程 TypeScript 构建通过。
- 运行 `openspec validate --all`，确认 OpenSpec 变更有效。
- 启动 Electron smoke test，确认新增主进程 realtime client 不影响应用启动。
- 使用默认 mock 配置验证原有本地 ASR 模拟仍可运行。
- 使用 provider 配置时，确认缺少 `OPENAI_API_KEY` 会在启动 live session 前显示本地配置错误。

## 已知限制

本 PR 完成实时 ASR streaming 链路，但 provider-backed translation、字幕修订 provenance 和真实桌面场景录制验证会在后续 PR 中继续推进。
