# 依赖与原创功能说明

本文用于说明声桥 LinguaBridge 使用的主要第三方依赖、外部服务接口和项目原创实现范围，便于公开仓库阅读与功能审查。

## 第三方依赖

| 依赖 | 用途 |
| --- | --- |
| `electron` | 桌面应用运行时、主窗口、悬浮字幕窗口、桌面来源枚举和主进程安全边界 |
| `react` / `react-dom` | 主工作台、字幕历史、状态面板和交互控件 |
| `vite` / `@vitejs/plugin-react` | 开发服务器与前端构建 |
| `typescript` | 类型检查和跨进程接口约束 |
| `concurrently` / `wait-on` | 本地开发时并行启动 Vite 与 Electron |

## 外部服务接口

| 服务 | 用途 | 配置 |
| --- | --- | --- |
| Aliyun DashScope / Model Studio | `fun-asr-realtime` 实时 ASR、Qwen 文本翻译 | `DASHSCOPE_API_KEY`、`REALTIME_ASR_PROVIDER=aliyun`、`TRANSLATION_PROVIDER=aliyun` |
| OpenAI API | 实时 ASR、文件转写、文本翻译 | `OPENAI_API_KEY`、`REALTIME_ASR_PROVIDER=openai`、`TRANSLATION_PROVIDER=openai` |
| DeepSeek-compatible API | 文本翻译 | `DEEPSEEK_API_KEY`、`TRANSLATION_PROVIDER=deepseek` |
| Custom-compatible API | 预留自定义翻译 provider | `CUSTOM_TRANSLATION_API_KEY` 或兼容 base URL |

Aliyun provider 可用同一个 `DASHSCOPE_API_KEY` 同时调用 `fun-asr-realtime` 和 Qwen 文本模型。DeepSeek-compatible provider 用于翻译已经识别出的文本，完整实时同传仍需要 ASR provider 将音频转换为文字。

## 系统音频捕获

Windows 系统音频优先通过 WASAPI loopback helper 能力检测接入，目标 helper 文件名为 `native-audio-helper/wasapi-loopback-helper.exe`。helper 缺失或当前平台受限时，应用会继续使用 Electron `desktopCapturer` fallback，并在工作台展示捕获能力、限制说明和备用输入建议。

系统音频捕获的实际效果会受 Windows 权限、输出设备、会议/通话软件策略和 Electron 桌面捕获能力影响。麦克风和文件模拟作为可用 fallback 保留在主流程中。

## 原创实现范围

- 桌面同传主工作台、状态面板、字幕历史和恢复操作。
- 系统音频、麦克风和文件模拟三类输入的统一入口。
- provider-ready 音频块合约、payload metadata、队列深度和丢弃统计。
- Electron 主进程 provider session，负责密钥边界、健康状态、实时 ASR 生命周期和翻译请求。
- Aliyun DashScope WebSocket `fun-asr-realtime` 协议适配、音频 payload 转换和 ASR 事件映射。
- Qwen / DashScope OpenAI-compatible 翻译请求构造、上下文传递和错误兜底。
- ASR partial/final 事件到字幕片段的稳定 ID 映射。
- 翻译上下文、延迟记录、错误兜底和 provider/model 标记。
- 字幕修订归并逻辑，包括 ASR partial 修正、ASR final、翻译修正、重连恢复和 fallback 来源。
- 悬浮字幕窗口、紧凑状态展示和可选译文播报队列。
- 真实桌面场景验证清单，覆盖浏览器视频、会议软件、通话软件、麦克风 fallback、悬浮字幕和译文播报。

## 密钥与隐私边界

`.env` 只用于本地运行，真实 API Key 不应提交到仓库。渲染进程只接收密钥是否存在、缺失项和 provider 状态，实际密钥读取与 provider 调用位于 Electron 主进程。阿里百炼模式使用 `DASHSCOPE_API_KEY`，OpenAI 模式使用 `OPENAI_API_KEY`，DeepSeek 翻译模式使用 `DEEPSEEK_API_KEY`。

文件模拟会读取用户选择的本地音视频文件。使用真实 provider 时，音频或转写文本会按配置发送给对应服务；使用 mock provider 时，流程在本地模拟。
