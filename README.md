# Simultaneous Interpretation

桌面端 AI 同声传译助手，用于将会议、网课、技术分享、视频或通话中的音频实时转换为双语字幕。

## 文档语言约定

本项目的 README 及后续 README 更新默认使用中文撰写。涉及命令、环境变量、依赖名称、API 名称和代码路径时保留原文。

## 当前状态

PR 1 已完成项目骨架：

- Electron 桌面应用壳
- 基于 Vite 的 React 渲染层
- TypeScript 配置
- 环境变量样例
- OpenSpec 驱动的 PR 任务计划

PR 2 新增主工作台 UI 壳：

- 顶部音频源、语言方向和会话控制区
- 中央实时字幕区域
- 右侧会话历史区域
- 底部音频、ASR、翻译队列、延迟和 TTS 状态条

后续功能会继续按独立 PR 推进，保证仓库保留清晰、连续的开发记录。

## 计划能力

- 捕获电脑系统音频、麦克风输入和本地文件模拟播放。
- 将音频流式送入 ASR 和翻译服务。
- 第一版支持英语转中文、中文转英语。
- 当识别或翻译结果变得更准确时，自动修订最近字幕。
- 提供主工作台和悬浮字幕窗口。
- 在字幕链路稳定后，增加可选的译文语音播报。

## 开发环境

前置要求：

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

以开发模式运行桌面应用：

```bash
npm run dev
```

构建并运行本地构建产物：

```bash
npm run build
npm start
```

如果在特殊终端环境中 Electron 被当作普通 Node 进程启动，请先清除 `ELECTRON_RUN_AS_NODE` 后再启动应用。

## 环境变量

后续 AI 能力接入时，请复制 `.env.example` 为 `.env`，并在本地填写 API Key。

```bash
copy .env.example .env
```

真实密钥只保存在本地环境中，请勿提交到仓库。

## 交付流程

实现过程遵循 OpenSpec 任务：

```text
openspec/changes/add-desktop-simultaneous-interpretation/tasks.md
```

每个 PR 只实现一个任务组，并在 PR 描述中说明功能作用、使用方式、实现思路和验证方式。每次合并后，`main` 分支都应保持可运行状态。

## 第三方依赖

当前骨架依赖：

- Electron：桌面应用壳
- React：渲染层 UI 框架
- Vite：前端开发和构建工具
- TypeScript：静态类型检查
- concurrently 和 wait-on：本地开发进程编排

当前原创实现包括项目结构、Electron 窗口配置、preload 桥接、React 入口、主工作台 UI 壳、OpenSpec proposal、design、specs 和任务计划。
