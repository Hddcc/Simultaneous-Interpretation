# 声桥 LinguaBridge 依赖与原创功能说明

## 第三方依赖

- `electron`：桌面应用运行时，负责主窗口、悬浮窗口、桌面来源枚举和主进程能力。
- `react`、`react-dom`：渲染层 UI 框架。
- `vite`、`@vitejs/plugin-react`：开发服务器和构建工具。
- `typescript`：静态类型检查和跨模块契约。
- `concurrently`、`wait-on`：开发模式下同时启动 Vite 和 Electron。
- `@types/node`、`@types/react`、`@types/react-dom`：TypeScript 类型声明。

## 浏览器与系统能力

- Electron desktopCapturer：枚举桌面或窗口来源。
- MediaDevices API：麦克风和桌面媒体流采集。
- Web Audio API：音量分析和统一音频块节奏。
- Web Speech API：本地译文语音播报。

## 原创功能

- 桌面同传工作台 UI。
- 音频源选择、状态管理和错误提示。
- 文件模拟实时音频块生成。
- 麦克风和系统音频统一音频块契约。
- 流式 ASR 事件模型和模拟 ASR 客户端。
- 结构化语言对配置和模拟翻译客户端。
- 双语字幕展示、版本化字幕修订和修订窗口。
- 悬浮字幕窗口、位置控制和字幕同步。
- 可选译文语音播报队列。

## 当前模拟能力

当前 ASR 和翻译使用本地模拟实现，便于在没有外部 API Key 的情况下复现实时链路。真实模型接入时，可以沿用现有 `src/asr`、`src/translation` 和环境变量配置进行替换。
