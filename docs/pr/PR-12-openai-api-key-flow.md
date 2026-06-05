# Add OpenAI API key flow

## 功能描述

本次变更新增真实 OpenAI API Key 运行流程。用户可以在本地 `.env` 中启用 OpenAI provider，通过“文件模拟”选择本地音频或视频文件，由 Electron 主进程调用 OpenAI 转写接口生成原文，再调用 OpenAI 文本生成接口生成译文字幕。

## 实现思路

- Electron 主进程读取本地 `.env`，并判断 `OPENAI_API_KEY` 是否已配置。
- 新增主进程 IPC：获取 AI 运行配置、调用真实翻译、调用本地媒体文件转写。
- preload 暴露受控 API 给渲染进程，避免前端直接读取或打包真实密钥。
- 翻译客户端改为异步接口，模拟模式保留原行为，OpenAI 模式下稳定片段调用真实翻译。
- 文件输入在 `openai/provider` 模式下先转写真实文件，再将转写文本拆分成字幕片段进入现有字幕、历史、悬浮窗和可选播报链路。

## 测试方式

- 运行 `npm.cmd run build`，确认 TypeScript 和 Vite 构建通过。
- 启动 Electron 冒烟测试，确认桌面应用不会启动即退出。
- 检查 `.env.example`，确认真实 Key 只作为本地配置示例出现。
- 检查 README，确认内部提交资料路径没有暴露。

## 已知限制

当前真实 ASR 入口优先支持本地音频/视频文件。麦克风和系统音频的真实流式 ASR 仍需后续新增音频 Blob/PCM 编码、分片上传和服务端流式会话管理。
