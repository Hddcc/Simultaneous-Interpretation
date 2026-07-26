## Why

当前实时同传链路在语速较快时会出现明显积压：视频已经讲到后续句子，主字幕仍在输出较早句子的翻译；现有界面还会把 ASR、快速翻译和润色耗时累加为一个数字，无法判断首次译文何时真正可见。需要先建立可信的分阶段计时，再让主字幕调度追上实时音频并以量化 SLO 验收。

本次变更需要把系统从“完整处理每个字幕任务”推进到“主屏追实时、历史可补全、润色让路”的追帧补全模式，保证用户观看视频、会议或通话时不会被旧字幕拖离当前语境。

## What Changes

- 引入追帧补全调度策略：主字幕通道只接受当前或最近有效 cue，旧 partial 和过期翻译不再抢占主屏。
- 建立跨音频采集、ASR、翻译调度、首次草稿可见和润色的时间戳契约，通过内部 telemetry 和验收报告分别记录快速翻译、端到端和润色延迟。
- 将“合格 ASR partial 到首个中文草稿可见”的平均延迟控制在 500ms 内，并以 P95 900ms 约束长尾；端到端首稿以 P50 800ms、P95 1500ms 为参考场景目标。
- 明确 final ASR 不丢弃：final 源文和可用译文应进入历史补全通道，即使它们返回较晚。
- 将 translation scheduler 从普通队列扩展为实时优先队列，限制主通道 in-flight 和等待深度，支持旧 partial 淘汰、latest-wins、history backfill 和可诊断的丢弃原因。
- 增加可配置的 fast-draft 翻译路径，允许使用当前 provider 下的低延迟模型或流式响应；final 和润色继续承担质量修正。
- 将 refinement scheduler 变为最低优先级后台任务：实时积压、ASR/翻译队列压力或可见延迟过高时暂停或跳过润色。
- 增加内部 catch-up diagnostics：记录落后句数、主通道队列深度、历史补全深度、旧 partial 淘汰数、晚到 final 补全数、主屏过期拦截数和润色暂停原因，并供测试与验收报告读取。
- 将 ASR 事件传递从 renderer 轮询优先改为 Electron 主进程主动推送，保留轮询作为恢复路径。
- 保持现有客户端界面与操作方式，不新增可见标签、按钮、面板或控制项；本次改动聚焦内部实时链路、调度和度量。
- 保持当前翻译 provider 兼容性；本次重点优化链路和调度，并允许内部 fast-draft 模型配置。

## Capabilities

### New Capabilities
- `realtime-catch-up-scheduling`: 定义实时追帧补全调度、分阶段延迟 SLO、主屏实时性、历史补全、队列压力和丢弃边界。

### Modified Capabilities
- `realtime-interpretation-pipeline`: 翻译调度和 ASR 事件传递需要支持可信时间戳、fast draft、latest-wins、主通道限深、历史补全和主动 push。
- `lyric-caption-playback`: active cue 需要优先追随当前语音，禁止晚到旧译文把主字幕回退到过期句子。
- `revision-aware-subtitles`: final ASR、晚到译文和补全结果需要以历史修订或 backfill provenance 记录，避免丢失完整性。
- `subtitle-refinement`: 润色通道需要在实时积压时自动让路，并记录暂停、跳过和恢复原因。
- `desktop-scenario-verification`: 需要增加固定样本延迟基准、快速语速、连续长句和积压恢复场景验证。

## Impact

- Affected code: `src/translation/scheduler.ts`, `src/translation/refinementScheduler.ts`, `src/captions/cue.ts`, `src/subtitles/reconciliation.ts`, `src/App.tsx`, `electron/providerSession.ts`, `electron/preload.ts`, `types/preload.d.ts`, verification tests and docs.
- Affected UX: 客户端视觉结构、标签、按钮和操作流程保持不变；已有字幕区域会更接近当前语音，旧句继续通过现有历史能力补全。
- Affected runtime behavior: 队列将更激进地限制主通道积压，旧 partial 会被淘汰，final 和历史补全会尽量保留；实时路径可选择更低延迟的模型或流式输出。
- Dependencies: 不强制引入新 provider；继续使用当前 Electron/React/Vite 架构和 provider-compatible API，并优先复用现有依赖。
