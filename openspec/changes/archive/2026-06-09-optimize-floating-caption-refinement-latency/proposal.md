## Why

当前版本已经具备实时桌面同传、歌词式 active cue 和悬浮字幕，但悬浮字幕窗口仍有明显“网页容器”痕迹：会出现滚动条，移动和锁定体验不足，双语歌词排版还不够像用户长期观看时会信任的桌面字幕工具。同时，直译结果容易出现翻译腔，实时速度仍受音频分片、轮询、翻译调度和修订策略影响。

下一步需要把体验从“能同传”推进到“可长时间观看”：悬浮字幕像桌面歌词一样自然，译文先快出再由大模型润色修订，低延迟链路以企业级流式字幕的思路持续压缩可见字幕延迟。

## What Changes

- 重构悬浮字幕窗口为网易云音乐歌词式体验：无滚动条、可自由拖动、hover 显示轻量控制、支持锁定和鼠标穿透、双语字幕同屏显示。
- 增加字幕动态排版规则：固定窗口内显示当前译文、源文和上一句上下文，长句通过换行、clamp、动态字号和淡出处理保持可读。
- 新增大模型双语润色慢通道：快速翻译先显示，final 或稳定 cue 再进入润色队列，对中文和英文同时做自然化表达修订。
- 将润色结果作为 revision 原地更新 active cue 或最近历史 cue，保留修订来源、延迟和 provider metadata。
- 优化低延迟链路：更小音频分片、可配置 stable partial 阈值、减少 ASR 事件轮询感、细化延迟诊断和队列压力指标。
- 保持真实 provider 最少配置原则：默认复用现有阿里百炼/Qwen 或当前 translation provider 做润色，不要求用户额外配置第二个 key。
- README 和验证文档补充悬浮歌词窗、润色、延迟调参、鼠标穿透和 known limitations。

## Capabilities

### New Capabilities

- `subtitle-refinement`: 定义大模型双语润色慢通道、自然化表达、术语保护、修订合并、provider 复用和失败兜底。

### Modified Capabilities

- `desktop-caption-experience`: 悬浮字幕窗口需要支持可拖动、锁定、鼠标穿透、无滚动条、hover 控制和双语歌词式排版。
- `lyric-caption-playback`: active cue、previous cue 和 floating cue 的显示规则需要支持固定窗口内双语歌词排版和润色修订状态。
- `realtime-interpretation-pipeline`: 实时链路需要支持更小音频分片、可配置 stable partial 策略、细化延迟指标和快慢双通道输出。
- `revision-aware-subtitles`: 修订来源需要覆盖 refinement revision，并保证润色结果只更新当前 cue 或 revision window 内的最近历史。

## Impact

- Affected code: `electron/main.ts`, `electron/preload.ts`, `types/preload.d.ts`, `src/App.tsx`, `src/styles.css`, `src/captions/cue.ts`, `src/translation/scheduler.ts`, `src/translation/client.ts`, `electron/translationPrompt.ts`, subtitle reconciliation and verification tests.
- Affected UX: 悬浮字幕窗口、主客户端歌词字幕、设置/诊断入口、字幕修订状态、双语显示、延迟提示。
- Affected runtime behavior: 音频 chunk 时长、ASR event polling/push cadence、translation scheduler thresholds、refinement queue, revision merge and latency diagnostics.
- Dependencies: 继续使用当前 Electron/React/Vite 架构和现有 provider。可复用 Qwen/OpenAI/DeepSeek-compatible text provider 作为润色模型；不引入重量级 UI 框架。
