# Add live audio capture spike

## 功能描述

本次变更新增完整实时同传链路的第一步：实时音频架构审计、Windows 系统播放声捕获方案选择，以及最小 helper capability 检测。应用现在可以在系统音频源区域展示 WASAPI loopback helper 是否可用，并保留现有 Electron desktopCapturer、麦克风和文件流程。

## 实现思路

- 新增 `docs/architecture/live-audio-capture-audit.md`，记录当前 Electron 音频、mock ASR、文件转写和翻译链路的可复用集成点。
- 选择 `windows-wasapi-loopback-helper` 作为第一条完整系统播放声捕获路径。
- 新增 `electron/nativeAudioCapability.ts`，检测 `native-audio-helper/wasapi-loopback-helper.exe` 是否存在并返回 helper 状态、目标采样率、chunk 时长、fallback 和下一步。
- 通过 Electron IPC 和 preload 暴露只读 capability，不启动 helper，不读取 PCM，不改变现有开始/暂停流程。
- 在系统音频区域和底部状态条展示 helper capability，帮助后续 PR 接入真实 payload chunk。

## 验证方式

- 运行 `npm.cmd run build`，确认 TypeScript 与 Vite 构建通过。
- 运行 `openspec validate --all`，确认 OpenSpec 变更有效。
- 启动 Electron 冒烟测试，确认应用不会启动即退出。
- 切换到系统音频源，确认 helper capability 是只读诊断状态，现有刷新来源和捕获 fallback 仍可使用。

## 已知限制

本 PR 只完成能力检测和架构决策。真实 WASAPI helper、PCM 帧输出、payload chunk contract 和 realtime ASR 会在后续独立 PR 中实现。
