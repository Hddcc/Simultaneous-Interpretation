# PR 3 - 音频源选择与文件模拟

## 标题

新增音频源选择和本地文件模拟输入

## 功能描述

本 PR 为桌面端同声传译工作台加入输入源选择能力。用户可以在“系统音频”“麦克风”“文件模拟”之间切换，并通过“文件模拟”选择本地音频或视频文件，按实时节奏生成统一格式的模拟音频块。

当前文件模拟会展示：

- 当前输入源和输入状态
- 已选择文件名称、类型和大小
- 最近生成的音频块时间戳
- 最近 5 个音频块的元数据
- 模拟音量活动

## 实现思路

- 新增 `AudioSourceType`、`AudioSessionState`、`NormalizedAudioChunk` 等输入源模型。
- 通过 Electron `dialog.showOpenDialog` 选择本地媒体文件。
- 通过 preload 暴露 `selectLocalMediaFile` 给 React 渲染层。
- 使用 500 ms 定时器生成模拟音频块，统一为 16 kHz、mono、带时间戳的输入契约。
- 系统音频和麦克风先完成源选择和状态提示，真实采集留给后续 PR。
- README 调整为产品使用说明风格。

## 验证方式

- `npm.cmd run build`
- Electron smoke test
- 手动选择“文件模拟”并确认可生成带时间戳的 chunk 记录

## 变更范围

本 PR 只覆盖音频源选择、文件选择、文件模拟输入和产品说明式 README。麦克风真实采集、系统音频真实采集、ASR、翻译和字幕修订将在后续 PR 实现。
