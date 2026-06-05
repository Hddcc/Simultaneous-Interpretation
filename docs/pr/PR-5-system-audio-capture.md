# PR 5 - 系统音频采集

## 标题

接入系统音频来源选择和桌面音频采集

## 功能描述

本 PR 为桌面端同声传译工作台加入第一版系统音频采集路径。用户可以刷新桌面或窗口来源，选择目标来源后点击“开始”，应用会尝试捕获该来源提供的音频轨道，并按统一音频块契约生成带时间戳的输入记录。

当前系统音频采集会展示：

- 可选桌面或窗口来源列表
- 当前选中的桌面来源
- 最近生成的系统音频块时间戳
- 最近 5 个系统音频块的元数据
- 实时音量活动
- 来源不支持音频时的可恢复错误提示

## 实现思路

- 通过 Electron `desktopCapturer.getSources` 枚举 `screen` 和 `window` 来源。
- 通过 preload 暴露 `listDesktopAudioSources` 给 React 渲染层。
- 使用 Chromium desktop capture 约束调用 `getUserMedia`。
- 对捕获流进行音频轨道检查，缺少音频轨道时给出错误提示。
- 通过 Web Audio `AnalyserNode` 读取音量活动。
- 每 500 ms 将系统音频输入转换为统一的 `NormalizedAudioChunk` 元数据。

## 验证方式

- `npm.cmd run build`
- Electron smoke test
- 在支持桌面音频共享的环境中选择浏览器、播放器或会议窗口，观察音量和 chunk 记录

## 变更范围

本 PR 只覆盖系统音频来源枚举、桌面音频采集、音量分析、错误提示和 README 产品说明更新。ASR、翻译、字幕修订、悬浮字幕和 TTS 将在后续能力中实现。
