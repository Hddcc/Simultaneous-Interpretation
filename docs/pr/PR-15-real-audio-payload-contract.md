# Add real audio payload chunk contract

## 功能描述

本次变更新增实时 ASR 可消费的音频短块合约。麦克风和系统音频采集不再只产生音量与时间戳，也会为每个 500 ms 短块附带 PCM16/base64 payload、采样格式、payload 可用性、provider-ready 状态和队列指标。

文件模拟与真实文件转写路径继续保留统一的 `NormalizedAudioChunk` 结构，并通过 `metadata-only` 标记明确区分模拟块和真实实时音频块。

## 实现思路

- 扩展 `src/audio/types.ts`，新增 `AudioPayload`、`AudioPayloadMetadata` 和 `AudioChunkQueueState`。
- 在 `src/audio/simulator.ts` 中增加 `createPcm16PayloadFromTimeDomainSamples`，把 Web Audio analyser 的 time-domain samples 转为 PCM16 little-endian 字节并编码为 base64。
- 麦克风与系统音频 live capture 每 500 ms 读取一次 analyser snapshot，同时生成音量和 payload，写入统一音频块。
- 在 `App.tsx` 中维护最多 12 个短块的有界 payload 队列，记录队列深度、最近 payload 字节数和累计丢弃数。
- 底部状态栏和输入源状态展示最近 payload 格式、provider-ready 状态和队列情况，为后续 realtime ASR session 接入提供可见诊断。

## 测试方式

- 运行 `npm.cmd run build`，确认 TypeScript 与 Vite 构建通过。
- 运行 `openspec validate --all`，确认 OpenSpec 变更仍有效。
- 启动 Electron smoke test，确认应用可以正常打开并退出。
- 使用麦克风或系统音频开始采集，确认状态栏出现 `Payload`、`队列` 和 `provider-ready` 信息。
- 使用文件模拟路径，确认仍显示 `metadata-only`，历史字幕和文件转写流程不受影响。

## 已知限制

本 PR 只建立实时音频 payload 合约和本地队列状态。音频 payload 还没有发送给云端 ASR，会在后续 realtime provider session 与 ASR streaming PR 中接入。
