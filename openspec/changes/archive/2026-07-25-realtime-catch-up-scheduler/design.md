## Context

当前链路已经支持系统音频/麦克风/文件输入、实时 ASR、partial/final、低延迟翻译调度、歌词式 active cue、历史记录和大模型润色。用户反馈的慢已经表现为“视频讲到第三句，字幕还停留在第一句”，这说明链路吞吐低于语音输入速度，旧任务正在占用主字幕和调度资源。

当前主界面的延迟数字把 ASR、快速翻译和润色耗时相加。ASR 事件又使用全局最新音频块估算延迟，可见延迟从 ASR 到达后才开始计算，因此现有数字既不能表示首次草稿等待时间，也不能形成可信的端到端分位数。实现优化前必须建立同一语义下的时间戳和样本聚合口径。

本次变更限定为内部实时链路和调度优化。允许调整 Electron 主进程、preload contract、renderer 内部 orchestration、scheduler、cue/reconciliation 数据结构以及测试工具，但客户端现有 JSX/CSS 结构、可见标签、按钮、面板和操作入口保持不变。新增指标只进入内部 telemetry、自动化测试输出和验收报告。

实时同传的核心目标不是把所有任务按创建顺序做完，而是让主字幕始终贴近当前讲话内容，同时让 final 内容和晚到译文尽量进入历史补全。这个设计将主链路拆成三层：

```text
主字幕通道：当前/最近 cue，极低队列深度，latest wins
历史补全通道：final ASR 和晚到译文，尽量完整保存
润色通道：最低优先级，空闲时修订，积压时让路
```

## Goals / Non-Goals

**Goals:**

- 主字幕不被旧 partial、旧翻译或润色结果拉回过去。
- final ASR 不被随意丢弃，尽量进入历史并可被补译。
- 旧 partial 可以被淘汰，重复 revision 可以复用或跳过。
- 翻译调度可诊断：内部记录落后句数、主通道积压、历史补全、过期拦截和润色暂停，并可由测试与验收报告读取。
- ASR 事件优先由主进程主动推送，减少 renderer 轮询带来的等待。
- 合格 ASR partial 到首个草稿可见的 provider-backed 样本平均延迟不超过 500ms，P95 不超过 900ms。
- partial 对应最后一个音频样本到首个草稿可见的端到端样本 P50 不超过 800ms，P95 不超过 1500ms。
- 主字幕最多落后最新可翻译 cue 一个 segment，压力解除后 2 秒内恢复健康状态。
- 保持当前 provider 兼容性，允许 fast-draft 路径使用低延迟模型或流式输出，final 和 refinement 保留质量修正职责。

**Non-Goals:**

- 不强制更换 provider，不引入端到端 LiveTranslate provider。
- 不承诺零延迟或完全逐字同步。
- 不把 final 或 refinement 完成时间计入首次草稿 SLO。
- 不新增或重排客户端可见标签、按钮、面板、状态徽标、设置项和交互入口。
- 不为内部 catch-up、backfill、SLO 或 refinement 状态创建新的前端展示。
- 不把所有 partial 都持久化为历史字幕。
- 不让润色成为实时链路的必经步骤。
- 不引入云端账号、多人同步或持久化数据库。

## Decisions

### Decision 1: 主屏采用 latest-wins，历史采用 final/backfill

主字幕只接受当前 active segment 或最近有效 segment 的 ASR/翻译/润色结果。旧结果如果晚到，不能覆盖主字幕；如果属于 final ASR 或 final 对应译文，则进入历史补全通道。

Alternative considered: 按请求顺序完整显示每句字幕。这会保留完整顺序，但在语速快或网络慢时必然越积越多，最终失去同传价值。

### Decision 2: 区分“淘汰旧 partial”和“保留 final”

partial 是临时草稿，旧 partial 被更新 revision 或新 segment 超越后可以淘汰。final 是句子定稿，应该保留源文和补译机会，即使晚到也应进入历史。

Alternative considered: 所有事件一视同仁保留。这会让过期 partial 消耗翻译额度和队列，并拖慢当前字幕。

### Decision 3: 翻译 scheduler 分主通道和历史补全通道

主通道限制为极小深度，例如当前 in-flight 1 个、最新 pending 1 个。历史补全通道可以保留 final jobs，但需要限流，并且不能阻塞主通道。主通道有新当前 cue 时，旧 pending partial 直接淘汰；旧 in-flight 返回后根据当前 revision 决定应用到主屏、补历史或仅诊断记录。

Alternative considered: 继续使用单一 bounded queue。单队列很难同时满足实时追帧和历史完整性，因为旧任务会和当前任务竞争同一处理槽。

### Decision 4: 润色根据压力自动暂停

润色只处理 final 或稳定 cue。若主通道 in-flight/pending 超阈值、ASR provider 队列有积压、可见延迟超阈值，润色 scheduler 暂停新任务，已返回的旧润色只能修订仍在窗口内的 cue 或历史。

Alternative considered: 润色总是运行。这样会增加文本模型请求量，和实时粗译争资源，用户会先感知到慢。

### Decision 5: ASR events 从 pull 优先改为 push 优先

Electron 主进程收到 provider ASR event 后主动推送到 renderer，renderer 立即处理。现有 pull 保留为恢复机制，用于漏事件或重连后补齐 buffered events。

Alternative considered: 继续 180ms 轮询。轮询实现简单，但在每个 partial 上都会增加最多一个 polling interval 的额外等待。

### Decision 6: 追帧健康只进入内部诊断和验收报告

内部诊断快照记录 dropped partial、late final backfilled、active rollback blocked、history backlog、refinement paused reason 等指标，自动化测试和基准工具可直接读取。客户端继续使用当前界面，不增加标签、按钮、面板或状态展示。

Alternative considered: 在客户端诊断页或主字幕旁增加调度状态。该方案扩大前端改动范围，也会增加普通用户的界面负担。

### Decision 7: 使用分阶段时间戳和独立延迟指标

每个 provider ASR 事件需要携带与其文本证据对应的 `audioEvidenceEndAtMs`，renderer 记录 `asrReceivedAtMs`、`translationEligibleAtMs`、`translationRequestedAtMs`、`firstDraftReceivedAtMs`、`firstDraftVisibleAtMs`、`finalVisibleAtMs` 和 `refinementVisibleAtMs`。跨进程边界使用 epoch 毫秒，同一进程内部的请求耗时可使用单调时钟；缺失关键时间戳的样本不进入 SLO 聚合，并单独计数。

首次草稿延迟定义为 `firstDraftVisibleAtMs - translationEligibleAtMs`。端到端首稿延迟定义为 `firstDraftVisibleAtMs - audioEvidenceEndAtMs`。final 和 refinement 在内部指标中独立记录；现有客户端元素不新增或重排。

Alternative considered: 继续使用 ASR、翻译和润色耗时相加的 total。该值会随着后台润色突然增大，也无法反映用户第一次看到译文的时刻。

### Decision 8: SLO 使用参考样本集和分位数验收

强 SLO 统计 provider-backed、非 fallback、成功可见的首个草稿样本。固定英语音频样本在会话预热后至少采集 50 个 translation-eligible partial，报告 count、mean、P50、P95、max、错误数和缺失时间戳数。快速翻译平均值目标为 500ms，P95 目标为 900ms；端到端目标为 P50 800ms、P95 1500ms。浏览器/B站场景作为真实桌面补充证据，不取代固定样本基准。

Alternative considered: 只记录平均值。少量超长请求会被平均值掩盖，实时体验仍可能频繁卡顿。

### Decision 9: fast-draft 与 final/refinement 分离

active lane 只生成尽快可读的首个草稿，优先使用当前 provider 支持的低延迟模型配置或流式响应。首个可读草稿一旦出现即结束 fast-draft 计时；后续 token、final 翻译和润色以同一 cue revision 原地更新。provider 不支持流式时回退为完整响应，仍遵守主通道限深和 latest-wins。

Alternative considered: 所有阶段都使用同一个高质量非流式请求。该方案配置简单，但模型完整响应和较长 prompt 会直接占用实时预算。

### Decision 10: 主通道执行真实的并发限制和过期取消

active lane 默认最多一个 in-flight 和一个 latest pending job。新 revision 到达时替换旧 pending partial，并通过 `AbortSignal` 尝试取消已经过期的 in-flight partial；无论 provider 是否接受取消，旧响应都不能更新主屏。final backfill 使用独立、低优先级、有限深度的 lane。翻译压力存在时 refinement gate 保持关闭。

Alternative considered: 只在响应返回后判断 stale。该策略可以保护显示，却仍会让过期请求消耗连接、额度和 provider 并发，继续推高当前请求延迟。

## Risks / Trade-offs

- [Risk] 旧 partial 淘汰过激导致临时译文少。→ Mitigation: final 保留，历史补全保留，内部诊断记录淘汰数量，并提供代码或环境阈值配置。
- [Risk] 历史补全积压导致内存或请求成本增长。→ Mitigation: 历史补全队列限深、只保留 final、可合并同 segment revision。
- [Risk] 主字幕追实时后，历史顺序可能出现晚到补全。→ Mitigation: 历史按时间排序并显示补全/修订状态。
- [Risk] push 事件与 pull 恢复路径重复。→ Mitigation: event id 去重，pull 只补未处理 events。
- [Risk] 暂停润色会降低自然度。→ Mitigation: 实时优先，空闲恢复润色，历史可后补修订。
- [Risk] 更早触发 partial 翻译会增加语序修正和字幕闪动。→ Mitigation: fast draft 采用最小稳定阈值、同 cue 原地修订和可配置触发门槛，固定样本同时验证稳定性。
- [Risk] 更短音频分片和更多 partial 会增加 IPC、WebSocket、QPS 和计费压力。→ Mitigation: 主通道严格限深、相同 revision 去重、过期取消，并把请求量和限流错误纳入诊断。
- [Risk] provider 和公网波动使 500ms 目标无法在所有环境成立。→ Mitigation: 使用明确参考环境验收，持续报告 P95 和失败率，保留完整响应 fallback。
- [Risk] 流式草稿可能在内容过短时不可读。→ Mitigation: 只有达到最小可见字符或语义边界后才提交首个草稿，后续 token 原地更新。

## Migration Plan

1. 修正音频证据、ASR、translation eligible、请求、首次可见、final 和 refinement 时间戳，建立基准报告。
2. 扩展 ASR/provider event 管道，增加 push listener、event id 去重和 pull 恢复。
3. 重构 translation scheduler 为 catch-up scheduler，拆分 active lane 与 backfill lane并加入过期取消。
4. 接入 fast-draft 低延迟模型配置或 provider 流式响应，并保留完整响应 fallback。
5. 更新 caption cue 与 reconciliation：晚到旧翻译禁止主屏回退，final/backfill 进入历史。
6. 给 refinement scheduler 增加 pressure gate 和暂停诊断。
7. 更新内部 diagnostics、SLO 聚合和 verification scenarios，保持客户端可见界面不变。
8. 增加测试覆盖计时口径、快速语速、多 segment 积压、late final、late translation、refinement paused、push/pull 去重和目标分位数。

Rollback 可以关闭 catch-up 模式回到现有 scheduler；push 事件保留时，pull 仍可作为主路径。

## Open Questions

- 历史补全队列默认深度取多少合适：8、12 还是按分钟窗口？
- 当前阿里云账号和地域下，哪一个兼容模型配置能在质量可接受时稳定满足 fast-draft SLO？实现阶段通过同一固定样本基准选择，配置保持可替换。
