# Live Audio Capture Audit

## 现有链路

- Electron 主进程已经提供 `desktop:list-audio-sources`，可以枚举 screen/window 来源。
- 渲染进程的系统音频入口使用 `navigator.mediaDevices.getUserMedia` 和 `chromeMediaSource` 约束尝试捕获桌面来源。
- 麦克风入口可以获取真实 `MediaStream`，但当前下游 chunk 只记录时间、音量、来源和状态。
- 文件模拟入口按 500 ms 节奏生成测试 chunk；OpenAI 文件转写入口会一次性转写本地文件。
- ASR 客户端仍是本地模拟客户端，基于 chunk sequence 生成 partial/final 文本。
- 翻译客户端支持模拟翻译，并在 OpenAI 模式下对稳定文本调用主进程代理。

## 可复用集成点

- `electron/main.ts`：适合放本地 helper 检测、helper 进程控制和 provider 密钥边界。
- `electron/preload.ts` 与 `types/preload.d.ts`：适合暴露只读 capability 和后续 session 控制 API。
- `src/audio/types.ts`：后续扩展真实 audio payload、encoding、queue metadata。
- `src/App.tsx`：已有系统音频状态、音量、错误提示和底部指标，可承载 helper capability 与 fallback 状态。
- `src/asr/client.ts`：后续可以保留 mock client，同时新增 provider-backed realtime client。

## 捕获方案选择

第一条完整路径选择 **Windows WASAPI loopback helper executable**。

选择原因：

- Windows 是当前目标桌面环境。
- WASAPI loopback 能直接捕获默认输出设备的播放声，更接近浏览器、会议软件、播放器和通话场景。
- helper executable 比把 native addon 直接嵌进 Electron 更容易隔离故障、回滚和替换。
- Electron `desktopCapturer` 保留为 fallback，用于现有 UI、权限和来源枚举。

暂缓方案：

- Node native addon：性能和集成更直接，但构建链复杂，评审机器复现风险更高。
- 继续只用 Electron desktop capture：实现简单，覆盖腾讯会议、微信通话等场景的稳定性不足。
- 虚拟声卡：可作为用户侧 fallback，但对课程项目和普通用户启动体验不友好。

## 本 PR 的 spike 边界

- 新增主进程 helper capability 检测。
- 暴露 `wasapi-loopback-helper.exe` 是否存在、目标采样率、chunk 时长、fallback 和下一步。
- 在系统音频区域展示只读状态。
- 不启动 helper，不读取 PCM，不改变现有系统音频开始/暂停流程。

## 后续 PR 入口

- PR 2 将扩展 chunk payload contract。
- PR 3 将补 provider session shell。
- PR 4 将把真实 live chunks 接入 realtime ASR。
