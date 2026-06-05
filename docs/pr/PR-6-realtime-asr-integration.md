# Add realtime ASR integration

## 功能描述

本次变更新增实时 ASR 链路。应用会读取前端可见的 ASR 配置，将统一音频块送入流式 ASR 客户端，并在主工作台展示 partial 和 final 原文识别结果。

用户启动文件模拟、麦克风或系统音频采集后，可以在中央字幕区看到最新原文片段，在右侧记录区查看最近识别片段、状态、版本号和识别延迟。

## 实现思路

- 新增 `src/asr` 模块，包含配置读取、ASR 事件类型、片段模型和流式客户端接口。
- `.env.example` 提供 `VITE_AI_PROVIDER`、`VITE_ASR_MODE`、`VITE_ASR_MODEL`，只暴露非密钥配置。
- 默认使用本地模拟 ASR 客户端，按每三个音频块生成一个识别片段，并输出 partial/final 事件。
- 工作台在记录音频块时同步推送 ASR 客户端，并将事件合并成可更新的原文片段。

## 验证方式

- 运行 `npm run build`，确认 TypeScript、Electron 主进程和 Vite 构建通过。
- 运行 Electron smoke test，确认桌面应用可以启动并保持运行。
- 运行 `openspec validate --all`，确认 OpenSpec 变更仍然有效。
- 启动应用后，用文件模拟或麦克风输入观察中央原文字幕和右侧识别记录更新。

## 范围说明

本次只实现 ASR 配置、事件模型、流式识别接口和原文展示。翻译、字幕修订、悬浮字幕和 TTS 会在后续独立变更中完成。
