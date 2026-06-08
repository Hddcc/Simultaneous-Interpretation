# 阿里百炼单 Key 真实同传

## 标题

接入 Aliyun DashScope `fun-asr-realtime` 与 Qwen 翻译

## 功能描述

本次更新新增阿里百炼 / DashScope 单 Key 真实同传路径。用户只需要在本地 `.env` 中配置 `DASHSCOPE_API_KEY`，即可使用 `fun-asr-realtime` 做实时语音识别，并使用 Qwen 模型做文本翻译。

这条路径成为 README 中推荐的最少配置真实使用方案，同时保留 OpenAI、DeepSeek、custom 和 mock provider 作为可选路径。

## 实现范围

- 新增 `REALTIME_ASR_PROVIDER=aliyun` 和 `TRANSLATION_PROVIDER=aliyun`。
- Electron 主进程接入 DashScope WebSocket realtime inference。
- 支持发送 `fun-asr-realtime` `run-task` / `finish-task` 事件和 PCM 音频 chunk。
- 解析 Aliyun `task-started`、`result-generated`、`task-failed`、`task-finished` 事件并映射到现有 ASR 事件模型。
- 使用 DashScope OpenAI-compatible endpoint 调用 Qwen 翻译。
- 更新 `.env.example`、README、依赖与原创说明、最终验证说明。
- 增加 Aliyun provider 配置、ASR 事件映射和 Qwen 翻译消息测试。

## 验证方式

- `npm.cmd run build`
- `openspec validate --all`
- Aliyun provider 配置与 ASR 事件映射测试
- Qwen 翻译消息测试
- 字幕修订、live 状态、桌面场景测试
- Electron hidden-window smoke test
- API Key 扫描，确认未提交真实 `DASHSCOPE_API_KEY`

## 已知限制

- 真实桌面同传效果仍受系统音频捕获、会议/通话软件权限、网络和百炼模型额度影响。
- `fun-asr-realtime` 首版按 16 kHz mono PCM 发送音频；更高级的热词、说话人区分和多模型策略可后续扩展。
