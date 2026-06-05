# PR 4 - 麦克风采集

## 标题

接入麦克风设备选择和实时采集

## 功能描述

本 PR 为桌面端同声传译工作台加入麦克风真实采集能力。用户可以刷新麦克风设备列表，选择目标设备，点击“开始”后应用会读取麦克风输入，并按统一音频块契约生成带时间戳的输入记录。

当前麦克风采集会展示：

- 麦克风授权和设备枚举状态
- 当前选中的麦克风设备
- 最近生成的音频块时间戳
- 最近 5 个麦克风音频块的元数据
- 实时音量活动

## 实现思路

- 通过 Electron `session.defaultSession.setPermissionRequestHandler` 处理音频采集权限。
- 使用浏览器 `navigator.mediaDevices.getUserMedia` 获取麦克风输入。
- 使用 `enumerateDevices` 枚举可用 `audioinput` 设备。
- 使用 Web Audio `AnalyserNode` 读取音量活动。
- 每 500 ms 将麦克风输入转换为统一的 `NormalizedAudioChunk` 元数据。
- 暂停或切换输入源时停止媒体轨道并关闭 `AudioContext`。

## 验证方式

- `npm.cmd run build`
- Electron smoke test
- 在支持麦克风的桌面环境中选择麦克风并观察音量和 chunk 记录

## 变更范围

本 PR 只覆盖麦克风采集、设备选择、音量分析和 README 路线图表达调整。系统音频采集、ASR、翻译、字幕修订、悬浮字幕和 TTS 将在后续能力中实现。
