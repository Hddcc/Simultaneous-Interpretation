# 实时追帧与低延迟调优

声桥优先提交当前语音的可读译文，final 内容随后补全历史，润色只在实时链路健康时运行。客户端沿用现有字幕、历史和悬浮窗口；调度状态与分位数进入内部快照、测试输出和验收报告。

## 时间戳与指标

| 时间戳 | 含义 |
| --- | --- |
| `audioEvidenceEndAtMs` | 当前 ASR revision 所依据的最后一段音频结束时刻 |
| `asrReceivedAtMs` | Electron 主进程收到 provider ASR 事件的时刻 |
| `translationEligibleAtMs` | partial/final 满足翻译条件并进入 scheduler 的时刻 |
| `translationRequestedAtMs` | scheduler 真正向翻译 client 派发请求的时刻 |
| `firstDraftReceivedAtMs` | 收到第一个可读完整响应或流式草稿的时刻 |
| `firstDraftVisibleAtMs` | 首稿提交到现有 cue 的时刻 |
| `finalVisibleAtMs` | 完整翻译提交到 cue 或历史的时刻 |
| `refinementVisibleAtMs` | 润色结果提交到 cue 或历史的时刻 |

`fastDraft = firstDraftVisibleAtMs - translationEligibleAtMs`。`endToEnd = firstDraftVisibleAtMs - audioEvidenceEndAtMs`。final 从 eligibility 单独计算，refinement 从首稿可见时刻单独计算。后续 revision 保留第一次首稿与端到端样本。缺少必要时间戳或出现负值的样本会从对应分布排除，并增加 missing count。

## 调度结构

| 通道 | 默认边界 | 行为 |
| --- | --- | --- |
| active | 1 个 in-flight + 1 个 latest pending | 新 revision 替换旧 pending，尝试通过 `AbortSignal` 取消过期 partial |
| backfill | 1 个 in-flight + 8 个等待项 | 只保留 final，独立运行，不阻塞 active，溢出时记录 skipped backfill |
| refinement | 最多 3 个等待项 | active lag、翻译积压、ASR 队列或首稿延迟越界时暂停 |

晚到 partial 会被丢弃。晚到 final、final 译文和合格润色会更新历史，active rollback guard 保持主字幕在当前 segment。

## 参考 SLO

固定英语样本先完成 5 个 provider warm-up，再采集至少 50 个 provider-backed、非 fallback、成功可见的首稿。报告必须包含 count、mean、P50、P95、max、errors、fallbacks、missing timestamps、request count、superseded 和 cancellation。

| 指标 | 目标 |
| --- | --- |
| fast-draft mean | `<=500ms` |
| fast-draft P95 | `<=900ms` |
| end-to-end P50 | `<=800ms` |
| end-to-end P95 | `<=1500ms` |
| active lag | `<=1 cue` |
| 压力解除后的恢复 | `<=2000ms` |

fallback、provider error 和缺失时间戳都会显式报告，不会作为成功低延迟样本。

## 默认值与安全范围

```dotenv
VITE_AUDIO_CHUNK_DURATION_MS=160
VITE_PROVIDER_ASR_POLL_INTERVAL_MS=750
VITE_TRANSLATION_MIN_PARTIAL_CHARACTERS=10
VITE_TRANSLATION_MIN_PARTIAL_WORDS=3
VITE_TRANSLATION_PARTIAL_DEBOUNCE_MS=120
VITE_VISIBLE_LATENCY_WARNING_MS=1500

FAST_DRAFT_MODEL=qwen-turbo
FAST_DRAFT_STREAMING=true
REFINEMENT_PROVIDER=aliyun
REFINEMENT_MODEL=qwen-plus
```

| 参数 | 建议范围 | 主要取舍 |
| --- | --- | --- |
| 音频块 | `120-240ms` | 更短会增加 IPC/WebSocket 频率，更长会增加音频证据等待 |
| partial 字符数 | `8-18` | 更低更快，也会增加修订与请求尝试 |
| partial 词数 | `3-5` | 英语短句触发速度与稳定度的平衡 |
| debounce | `100-240ms` | 更低更快；active lane 限深负责控制请求增长 |
| poll recovery | `500-1000ms` | push 是主路径，poll 只负责漏事件与重连恢复 |

确定性 burst 测试用快速多 revision 验证 active 请求深度保持有界；真实默认值仍应使用相同固定样本复测 provider QPS、计费、P95 和字幕稳定度。模型对比必须保持音频、地域、网络、预热数和样本规则一致。

## 2026-07-25 模型选型结果

使用 Microsoft Zira 生成的固定英语音频及其 50 个渐进 partial，在同一 Windows、网络和 DashScope endpoint 下交替测试 `qwen-turbo` 与 `qwen-plus`。每个模型先预热 5 次，再采集 50 个真实流式响应；两者均为 50/50 成功、零 provider 错误，基础质量检查通过率均为 92%。

| 模型 | mean | P50 | P95 | max | 质量通过率 | 结论 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `qwen-turbo` | 293.5ms | 302ms | 362ms | 369ms | 92% | 满足 mean、P95 和质量门槛，选为默认 fast-draft |
| `qwen-plus` | 608.1ms | 615ms | 783ms | 918ms | 92% | P95 合格，mean 超过 500ms 强目标 |

模型基准测量请求派发到首个满足生产可读边界的流式草稿，用于隔离 fast-draft 模型选择。ASR、音频证据、renderer 可见提交、active lag 和恢复时间继续由完整 reference report 验证。原始逐请求证据见 `fast-draft-model-benchmark-2026-07-25.json`。
