## Context

当前真实翻译链路把 provider 异常转换为一个 `fallback=true` 的 `TranslationEvent`，同时令 `translatedText` 等于 ASR 原文。字幕 reconciliation、cue 和历史存储把该事件当作可见翻译提交，因此英译中失败会显示为两行相同英文。翻译错误写入共享的 `session.error`，后续音频 chunk 又会清空该字段，运行现场无法保留。

实时链路已经包含 active lane、backfill lane、流式草稿、取消旧 partial、final/history backfill 和 refinement。修复需要保留这些低延迟行为，并确保预期的 stale cancellation 不产生用户错误或原文译文。

## Goals / Non-Goals

**Goals:**

- 让成功、可恢复失败和取消在 Electron IPC、翻译客户端、调度器与字幕状态中保持不同语义。
- 只将符合当前目标语言方向的 provider 文本提交到译文槽位、历史和 refinement。
- 为 final 翻译失败提供一次有界恢复，不让恢复工作阻塞最新 active partial。
- 保留可操作的 provider 错误，直到翻译恢复、用户重试或会话重置。
- 用回归测试覆盖本次已复现的“源文本被当作译文”路径。

**Non-Goals:**

- 不替换现有 ASR、Qwen、OpenAI 或 DeepSeek provider。
- 不实现通用语言检测模型，不为纯专有名词或语言中性字面量承诺语义级翻译判断。
- 不增加无限重试、指数退避服务或新的用户配置面板。
- 不重构字幕历史格式之外的 UI、音频采集和 refinement 调度。

## Decisions

### 1. IPC 取消与 provider 失败保持显式语义

Electron 主进程在 `AbortController` 触发时传播可识别的取消结果，renderer 将其作为 stale cancellation 丢弃。主进程不得使用 `request.text` 构造成功响应。

非取消异常通过可序列化错误元数据返回或抛出，至少包含 provider、model、错误类别、HTTP 状态或 provider 错误码（可用时）以及用户可读消息。密钥和原始 Authorization 信息不得进入错误对象。

选择显式失败语义可以在 IPC 边界消除歧义。继续返回源文本会让下游无法判断 provider 真的回显了文本，还是请求已经失败。

### 2. 翻译事件允许“无有效译文”的失败状态

翻译客户端在异常时产生不含可见译文的失败事件，保留 `error`、`fallback` 和结构化失败元数据。reconciliation 与 cue 只在译文通过有效性校验时更新 `translatedText`；失败事件只更新诊断和错误状态。

已有有效译文保持可见。新 segment 尚无有效译文时继续使用现有等待文案；恢复尝试结束仍失败时使用明确的不可用状态。历史可以保存源文本和空译文，但历史 UI 不得用源文本填充译文行。

### 3. 使用确定性的轻量目标语言校验

校验在 provider 完整响应以及可读流式草稿提交前执行：

- 英语到中文：当源文本包含可翻译的拉丁字母词时，译文必须包含至少一个汉字。
- 中文到英语：当源文本包含汉字时，译文必须包含至少一个拉丁字母词。
- 规范化后与源文本完全相同，且源文本具有明确源语言特征、缺少目标语言特征时，结果无效。
- 仅由数字、符号、缩写或语言中性专名构成的文本不使用“必须改变”规则，避免拒绝本应保留的字面量。

校验只拦截明显未翻译的输出，不判断翻译质量。完整自然度仍由 provider 和 refinement 负责。

### 4. final 失败通过 backfill 容量恢复一次

partial 失败只记录并等待更新的 ASR revision，避免对快速变化文本重复重试。final 失败创建一个带独立去重键的恢复任务，最多执行一次，使用 `translationModel` 的非流式完整翻译路径。

恢复任务复用有界 backfill 容量，但保留“final recovery”原因。调度器始终优先派发最新 active partial；恢复成功后按 segment 是否仍为 active 决定更新当前 cue 或历史。恢复失败保留错误状态，不继续循环。

选择现有 backfill 容量可以限制并发和队列深度，同时避免新增第三条常驻队列。

### 5. 翻译错误与音频采集错误分离生命周期

renderer 保存按 segment/revision 关联的翻译 issue，音频 chunk 到达只更新采集状态，不清除翻译 issue。以下事件可清除 issue：同一 segment 的有效译文或恢复译文到达、用户重新开始/重试会话、语言方向变化或会话 reset。

主字幕和悬浮字幕使用同一派生状态。诊断快照记录失败类别、provider、model、首次/最近失败时间、恢复尝试和恢复结果；历史记录至少保留“是否存在有效译文”，无需把敏感或冗长 provider 响应写入本地存储。

### 6. refinement 仅接收有效译文

失败事件、空译文和目标语言校验失败结果均不进入 refinement。恢复成功产生有效译文后，可以沿用现有 final refinement 条件。这样避免 refinement 把英文回显进一步固化为“已修订”译文。

## Risks / Trade-offs

- [短句或专名可能缺少目标文字特征] -> 仅对具有明确源语言信号的文本执行强校验，并为语言中性字面量保留通过路径和单元测试。
- [final 恢复增加一次 provider 调用和历史延迟] -> 每个 final revision 最多恢复一次，复用有界 backfill 容量并记录请求数量。
- [保留旧译文可能与最新源文暂时不完全一致] -> UI 保留 revised/waiting 状态，恢复成功后原位更新；不使用源文本伪装新译文。
- [错误状态持续显示可能增加视觉噪声] -> 使用现有紧凑错误区域和悬浮状态标签，成功恢复或会话 reset 后立即清除。
- [结构化 IPC 错误改变类型契约] -> 同步更新 preload 类型与测试，不改变 renderer 对密钥隔离的安全边界。

## Migration Plan

1. 先补充失败、取消、语言校验和错误生命周期的回归测试，使当前行为稳定复现。
2. 更新 IPC 与翻译事件类型，再调整 client、scheduler、reconciliation 和 cue。
3. 更新主界面、悬浮字幕、历史投影和诊断，最后执行真实 Qwen 英译中冒烟验证。
4. 该变更不需要数据迁移；旧历史中已经保存的重复原文保持原样，新写入记录遵循新契约。
5. 如需回滚，可整体回退该变更；provider 与 `.env` 配置无需调整。

## Open Questions

- 无阻塞实现的问题。轻量语言校验阈值可在实现时通过中英混合、缩写、数字和专名测试微调，但不得扩展为外部语言检测依赖。
