# 声桥 LinguaBridge

> 桌面端 AI 同传助手。捕获电脑播放声、麦克风或本地文件输入，生成中英双语字幕，并支持悬浮字幕、字幕修订和可选译文播报。

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111827)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## 目录

- [项目简介](#项目简介)
- [功能亮点](#功能亮点)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [配置说明](#配置说明)
- [技术架构](#技术架构)
- [依赖与原创实现](#依赖与原创实现)
- [常见问题](#常见问题)
- [后续计划](#后续计划)

## 项目简介

声桥 LinguaBridge 面向会议、网课、技术分享、视频播放和跨语言通话场景。用户启动桌面应用后，可以选择系统音频、麦克风或本地文件模拟输入，在主工作台查看实时字幕，也可以打开悬浮字幕窗口叠在浏览器、会议软件或播放器上方。

当前版本使用本地模拟 ASR 与模拟翻译客户端，重点展示完整实时链路：音频输入、原文识别、双语翻译、字幕修订、悬浮窗口和可选语音播报。后续接入真实 AI 服务时，可以沿用现有 `src/asr`、`src/translation` 和环境变量配置。

## 功能亮点

| 能力 | 说明 |
| --- | --- |
| 多输入来源 | 支持系统音频、麦克风、本地音频/视频文件模拟 |
| 中英双向字幕 | 支持“英语 -> 中文”和“中文 -> 英语”两种方向 |
| 流式识别体验 | 按 500 ms 音频块持续推进 ASR partial/final 事件 |
| 字幕自动修订 | 最近字幕会随识别和翻译结果更新而原地修正 |
| 悬浮字幕窗口 | 支持紧凑、标准、宽屏尺寸和四个屏幕角落位置 |
| 译文语音播报 | 稳定译文可进入本地语音播报队列，支持暂停和停止 |

## 快速开始

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

构建项目：

```bash
npm run build
```

构建后启动：

```bash
npm start
```

如果 Electron 在特殊终端环境中被当作普通 Node 进程启动，请先清除 `ELECTRON_RUN_AS_NODE` 后再启动应用。

## 使用指南

### 选择音频源

- 系统音频：点击“刷新来源”，选择一个屏幕或窗口来源，再点击“开始”。
- 文件模拟：点击“选择本地文件”，选择音频或视频文件，再点击“开始”。
- 麦克风：点击“刷新麦克风”，选择可用设备，再点击“开始”。

### 查看双语字幕

中央区域优先显示译文字幕，原文作为辅助上下文显示在上方。右侧字幕记录会展示时间戳、语言方向、原文、译文、版本、修订原因、上下文数量和端到端延迟。

### 使用悬浮字幕

点击“打开悬浮字幕”后，应用会显示一个独立小窗口并保持在其他应用上方。可以选择紧凑、标准或宽屏尺寸，也可以将窗口移动到左上、右上、左下或右下。

### 开启译文播报

勾选“译文播报”后，稳定译文会进入本地语音播报队列。用户可以暂停、继续或停止播报；关闭译文播报会清空队列，字幕显示和悬浮字幕继续工作。

## 配置说明

应用默认使用本地模拟 ASR 和模拟翻译。需要调整配置时，请复制 `.env.example` 为 `.env`：

```bash
copy .env.example .env
```

可配置项：

| 变量 | 说明 |
| --- | --- |
| `VITE_AI_PROVIDER` | 当前默认为 `mock` |
| `VITE_ASR_MODE` | 当前默认为 `mock`，用于本地流式识别演示 |
| `VITE_ASR_MODEL` | 当前默认为 `mock-streaming-asr` |
| `VITE_TRANSLATION_MODEL` | 当前默认为 `mock-bilingual-translator` |
| `OPENAI_API_KEY` | 使用 OpenAI 文件转写和翻译时填写，模拟模式可留空 |
| `TTS_MODEL` | 后续云端 TTS 接入预留，当前版本可留空 |

需要使用真实 OpenAI 文件转写和翻译时，可按下面方式配置：

```dotenv
VITE_AI_PROVIDER=openai
VITE_ASR_MODE=provider
VITE_ASR_MODEL=gpt-4o-mini-transcribe
VITE_TRANSLATION_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your_openai_api_key
```

真实 OpenAI 链路当前优先支持本地音频或视频文件。麦克风和系统音频已具备采集入口，实时流式 ASR 仍需要后续补充分片上传和服务会话管理。

真实服务密钥只保存在本地运行环境中，请勿提交到仓库。

## 技术架构

```text
音频来源
  -> 统一音频块
  -> 流式 ASR 事件
  -> 结构化语言对
  -> 翻译事件
  -> 版本化字幕
  -> 主工作台 / 悬浮字幕 / 可选 TTS
```

主要目录：

```text
electron/          Electron 主进程与 preload 桥接
src/audio/         音频源类型、文件模拟和捕获 chunk 工具
src/asr/           ASR 配置、事件模型和模拟客户端
src/language/      中英语言对配置
src/translation/   翻译请求、事件和字幕片段模型
src/tts/           译文语音播报状态模型
docs/pr/           分阶段 PR 描述
```

## 依赖与原创实现

第三方依赖：

- `electron`：桌面应用运行时。
- `react` 和 `react-dom`：渲染层 UI 框架。
- `vite` 和 `@vitejs/plugin-react`：开发服务器与构建工具。
- `typescript`：静态类型检查。
- `concurrently` 和 `wait-on`：本地开发进程编排。
- OpenAI API：可选的本地文件转写和译文生成服务。

原创实现：

- Electron 主窗口和悬浮字幕窗口管理。
- preload 安全桥接和桌面来源枚举。
- 音频源状态模型、文件模拟、麦克风采集和系统音频块转换。
- 流式 ASR 事件模型和本地模拟 ASR 客户端。
- Electron 主进程中的 OpenAI 配置读取、文件转写代理和翻译代理。
- 结构化语言对配置和本地模拟翻译客户端。
- 双语字幕展示、版本化字幕修订和修订窗口。
- 悬浮字幕同步、本地译文播报队列和主工作台交互。

## 常见问题

### 系统音频无法捕获

系统音频通过 Electron 桌面来源采集能力实现。不同操作系统和不同应用对系统声音共享的支持不完全一致；如果所选来源没有提供音频轨道，界面会显示可恢复的错误提示。可以改用麦克风或文件模拟继续验证流程。

### 麦克风没有设备名称

部分系统会在授权前隐藏设备名称。点击“刷新麦克风”并允许权限后，设备名称通常会刷新出来。

### 语音播报没有声音

语音播报使用系统 Web Speech 能力。请确认系统有可用语音、应用未被静音，并且“译文播报”已开启。

### 字幕内容像演示文本

当前 ASR 和翻译客户端使用本地模拟实现，用于展示实时链路、字幕修订、悬浮窗和播报队列。真实服务接入时，可以替换 `src/asr` 与 `src/translation` 中的客户端实现。

## 后续计划

- 接入真实 ASR 和翻译服务。
- 增加更多语言方向。
- 优化系统音频在不同操作系统上的兼容性。
