# Add realtime provider session shell

## 功能描述

本次变更新增实时服务配置和 session 生命周期壳。应用现在可以从 Electron 主进程读取实时 ASR provider、翻译 provider、模型、base URL 和密钥可用性，并把 provider 健康状态、连接状态、队列深度和可恢复错误展示到工作台。

真实音频 payload 仍然会在本地采集并进入队列；本 PR 只建立 provider session 的本地边界和 IPC 契约，后续实时 ASR streaming PR 会把 payload 发送给云端服务。

## 实现思路

- 扩展 `.env.example`，新增 `REALTIME_ASR_PROVIDER`、`REALTIME_ASR_MODEL`、`REALTIME_ASR_BASE_URL`、`TRANSLATION_PROVIDER`、`TRANSLATION_MODEL`、`TRANSLATION_BASE_URL` 和可选 `DEEPSEEK_API_KEY`。
- 新增 `electron/providerSession.ts`，在主进程维护 provider runtime config、密钥缺失检查、session 状态、队列快照和拥塞状态。
- 在 Electron `main` 注册 provider health、start、queue update、stop IPC；密钥只在主进程读取，renderer 只接收布尔状态和缺失项。
- 在 preload 和全局类型中暴露 provider session API。
- 在工作台显示 Provider 模式、API Key 状态、服务状态和 provider 队列信息；系统/麦克风 live capture 启动前会先启动 provider session shell。

## 测试方式

- 运行 `npm.cmd run build`，确认 renderer 与 Electron 主进程 TypeScript 构建通过。
- 运行 `openspec validate --all`，确认 OpenSpec 变更有效。
- 启动 Electron smoke test，确认应用可以正常打开并关闭。
- 使用默认 mock 配置启动，确认 provider 状态显示为本地模拟。
- 将 `REALTIME_ASR_PROVIDER=openai` 且不配置 `OPENAI_API_KEY`，确认 live session 启动会显示缺少本地配置提示。

## 已知限制

本 PR 只提供 provider 配置、健康状态和 session 生命周期壳。实时 ASR WebSocket 或流式 HTTP 客户端、音频 payload 上传、partial/final ASR 事件会在后续 PR 中实现。
