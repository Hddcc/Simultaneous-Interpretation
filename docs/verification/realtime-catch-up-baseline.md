# 旧链路固定样本基线审计

审计基于变更前提交 `04b09d9` 的链路语义，参考配置为 `fun-asr-realtime`、`qwen-plus`、240ms 音频块、180ms renderer polling、14 字符/4 词 partial 门槛和 180ms debounce。API Key 不进入报告。

旧链路用全局最新音频块估算 ASR latency，只记录 ASR、翻译和润色的阶段耗时，并把润色继续累加到 total。它没有 `audioEvidenceEndAtMs`、`translationEligibleAtMs`、`firstDraftVisibleAtMs` 或 active cue ordinal，因此无法形成可审计的 fast-draft、end-to-end 和 active-lag 分布。

| 固定审计项 | 结果 |
| --- | --- |
| 样本槽位 | 50 |
| provider 配置 | Aliyun `fun-asr-realtime` + `qwen-plus` |
| 可用 fast-draft 样本 | 0 |
| 可用 end-to-end 样本 | 0 |
| missing first-visible timestamps | 50 |
| request count | 旧诊断未记录，记为 unavailable |
| active cue lag | 旧诊断未记录，记为 unavailable |
| mean / P50 / P95 / max | 无合格时间戳，均为 `null` |

该基线保留了优化前的测量缺口，避免用 ASR、翻译和润色耗时之和代替首稿延迟。新链路的数值验收从带相关时间戳的 provider-backed 样本开始；旧基线只用于证明计时契约和 active-lag 诊断必须先完成。
