## Why

当前版本已经能把桌面音频接入阿里实时 ASR 和 Qwen 翻译，但字幕体验仍偏“调试面板”：译文会在主字幕区累加，句子切换不清晰，等待最终识别后再翻译导致用户感知延迟明显。下一阶段需要把产品从“可验证链路”升级成真正适合看网课、会议和视频时长期打开的桌面同传客户端。

## What Changes

- 新增类似网易云歌词的字幕播放体验：主字幕只聚焦当前正在讲的一句，上一句淡出或进入历史，历史记录不干扰主视线。
- 将实时链路改为低延迟策略：稳定 partial 可触发临时译文，final 到达后修订，过期 partial 丢弃，避免用户一直看到“正在整理译文”。
- 引入字幕 cue 状态机，区分 `listening`、`drafting`、`translated`、`revising`、`final`，支撑平滑切句、修订和悬浮字幕同步。
- 全面重构桌面客户端 UI，使其成为一体化客户端界面：轻量侧栏、主字幕舞台、底部状态/控制、设置抽屉和历史抽屉，而不是网页式卡片工作台。
- 重构悬浮字幕窗口，使其成为核心观看体验，默认显示当前句和译文，减少元信息和调试标签。
- 保留诊断能力，但默认折叠到开发/高级区域，日常使用不展示 provider、payload、queue 等细节。

## Capabilities

### New Capabilities

- `lyric-caption-playback`: 定义歌词式字幕播放、当前句切换、上一句淡出、历史归档、悬浮字幕同步和修订展示规则。

### Modified Capabilities

- `realtime-interpretation-pipeline`: 增加低延迟 partial 翻译、翻译队列调度、过期结果丢弃、修订合并和可感知延迟目标。
- `desktop-caption-experience`: 将桌面客户端要求从工作台式布局升级为一体化客户端 UI，并定义主窗口、悬浮窗口、历史抽屉、设置抽屉和诊断入口的行为。
- `revision-aware-subtitles`: 补充歌词模式下的修订规则，要求修订优先更新当前 cue 或最近历史 cue，避免在主字幕区累加多版本文本。

## Impact

- Affected code: `src/App.tsx`, `src/styles.css`, `src/subtitles/reconciliation.ts`, `src/translation/client.ts`, `src/liveExperience/state.ts`, `src/audio/simulator.ts`, Electron floating caption IPC and provider session handling.
- Affected UX: 主窗口、悬浮字幕窗口、字幕历史、实时状态展示、音频源选择、播报控制和诊断入口。
- Affected runtime behavior: ASR partial/final 事件处理、Qwen 翻译触发时机、翻译请求去重、字幕修订合并、过期事件丢弃和延迟指标。
- Dependencies: 继续使用当前 React/Vite/Electron 架构和阿里 DashScope/Qwen provider；可引入轻量图标库或本地 SVG 图标，但不新增重型 UI 框架。
