## Context

当前链路已经具备系统音频/麦克风/文件输入、实时 ASR、低延迟翻译调度、歌词式 active cue、字幕修订和悬浮字幕。用户反馈集中在三个体验层面：

- 悬浮字幕仍像网页块，出现滚动条，缺少桌面歌词的自由拖动、锁定和轻量控制。
- 直译结果不够自然，尤其是英译中时容易出现翻译腔，影响观看课程和会议时的理解。
- 可见字幕延迟仍偏高，需要继续向企业级实时字幕方案靠拢。

本设计将这些优化合并为一次产品体验升级。核心原则是：第一屏字幕走快通道，润色和更自然表达走慢通道，所有慢通道结果都作为 revision 原地更新。

## Goals / Non-Goals

**Goals:**

- 将悬浮字幕做成可长期观看的桌面歌词窗：可拖动、无滚动条、双语同屏、hover 控制、锁定和鼠标穿透。
- 通过大模型润色慢通道提升中英文字幕自然度，同时保留术语和原意。
- 继续降低感知延迟，减少 ASR 轮询感和翻译等待感。
- 让延迟、润色队列、过期结果和修订来源可诊断。
- 保持最少配置体验，默认复用现有 provider 和 key。

**Non-Goals:**

- 不更换 Electron/React/Vite 架构。
- 不引入账户、云端同步、多人协作或计费。
- 不保证所有 provider 都有相同的 partial 稳定度和延迟。
- 不在这一轮实现专用本地 ASR 模型或自研 WASAPI helper。
- 不把润色放到阻塞路径中等待后再显示首屏字幕。

## Decisions

### Decision 1: Floating captions become a draggable lyric window

悬浮字幕窗口使用 frameless Electron window，字幕主体区域支持拖动，hover 时显示轻量工具条。工具条包含锁定、关闭、字号/透明度入口。锁定后窗口可启用 mouse events ignore，让用户把字幕盖在会议或网课上方。

视觉结构固定为：

```text
previous cue, faded
source text, small
translated text, large
compact status, hover-only controls
```

长文本不得产生滚动条。窗口通过 CSS clamp、line clamp、动态字号等级和 overflow fade 处理长句。译文永远视觉优先，语言方向决定上下文标签，不改变阅读层级。

Alternative considered: 保留当前窗口并只改颜色。这个方案无法解决拖动、锁定、滚动条和长期观看舒适度。

### Decision 2: Add a non-blocking refinement channel

实时链路拆成两条输出：

```text
ASR partial/final
  -> fast translation scheduler
      -> visible draft/final cue
  -> refinement scheduler, final or stable cue only
      -> refined bilingual text
      -> revision merge
```

润色请求输入 source text、translated text、language pair、recent context 和 terminology hints，输出 refinedSourceText、refinedTranslatedText、reason、provider metadata 和 latency。润色成功后更新 active cue 或 revision window 内的最近历史 cue。

Alternative considered: 翻译阶段直接要求模型产出最自然译文。这个方案会提高单次请求复杂度，也容易拖慢首屏字幕。双通道更符合实时字幕体验。

### Decision 3: Reuse configured text provider by default

默认用当前 translation provider 作为 refinement provider。阿里单 key 模式下复用 `DASHSCOPE_API_KEY` 和 Qwen；OpenAI/DeepSeek/custom 模式下复用对应文本 provider。后续可以增加 `REFINEMENT_PROVIDER`、`REFINEMENT_MODEL` 等配置，但第一版不要求用户多拿一个 key。

Alternative considered: 强制单独配置润色模型。这样灵活性更高，但违背当前“最少配置即可真实体验”的方向。

### Decision 4: Keep refinement bounded and revision-aware

润色只处理 final 或足够稳定的 cue。队列需要去重、限流、丢弃过期 revision，并记录 provenance 为 `refinement-correction`。如果用户已经进入新的 active cue，润色结果只允许更新 revision window 内的最近历史，不能打断当前句。

Alternative considered: 每个 partial 都做润色。这样成本和延迟都会失控，也会造成字幕频繁跳动。

### Decision 5: Optimize perceived latency through smaller chunks and faster event cadence

优先优化当前架构内可控项：

- 将音频 chunk duration 作为配置项，默认目标从约 500ms 下调到 160-250ms 区间。
- ASR provider event pull interval 下调，或在主进程有新事件时主动推送到 renderer。
- stable partial 阈值配置化，按字符数、词数、标点、停顿和 revision 稳定度综合判断。
- 翻译 scheduler 暴露更多诊断：eligible skipped、queued age、in-flight age、stale response age、visible update latency。

Alternative considered: 立即接入专用商业同传平台。短期接入成本高，也会削弱现有可控链路；可以作为后续 provider 扩展方向。

## Risks / Trade-offs

- [Risk] 润色可能改变原意。-> Mitigation: prompt 明确忠实原意、保留术语，并只作为 revision；保留 source/translated 原始版本用于诊断。
- [Risk] 双通道增加成本。-> Mitigation: 只对 final/稳定 cue 润色，队列去重、限流和可关闭。
- [Risk] 小音频分片增加 provider 压力。-> Mitigation: chunk duration 配置化，默认保守下调，诊断暴露队列压力。
- [Risk] 鼠标穿透后用户找不到窗口。-> Mitigation: 主窗口保留关闭/解锁入口，提供快捷恢复状态。
- [Risk] 无滚动条可能导致极长句信息不可见。-> Mitigation: 动态字号、最多行数、淡出提示和历史抽屉补充完整文本。
- [Risk] provider partial 稳定度差异很大。-> Mitigation: stability strategy 可配置，final 修订优先，过期结果丢弃。

## Migration Plan

1. 扩展 floating caption state 和 IPC，支持 locked、opacity、font scale、drag region、previous/source/translation layout metadata。
2. 重构 floating caption CSS 和 Electron window 行为，验证拖动、锁定、鼠标穿透和无滚动条。
3. 新增 refinement request/response 类型、prompt builder、provider client 和 scheduler。
4. 将 refinement revision 合并到 CaptionCue 和 SubtitleSegment，扩展 provenance 和 diagnostics。
5. 调整音频 chunk、ASR event cadence 和 translation scheduler threshold 配置。
6. 更新 README、验证文档和测试。

Rollback 可以关闭 refinement channel，并保留现有 fast translation 输出；悬浮字幕 UI 可退回标准窗口显示，不影响核心同传链路。

## Open Questions

- 字幕锁定/解锁是否需要全局快捷键，还是主窗口按钮即可？
- 默认润色模型是否沿用 `TRANSLATION_MODEL`，还是提供 `REFINEMENT_MODEL` 占位但默认同值？
- 悬浮字幕是否需要预设尺寸：网课模式、会议模式、底部歌词模式？
- 小音频分片默认值应先取 200ms 还是 250ms，以兼顾 provider 压力和延迟？
