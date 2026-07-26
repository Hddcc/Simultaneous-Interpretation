# Fast-draft 模型基准：2026-07-25

## 结论

阿里云 fast-draft 默认选择 `qwen-turbo` 并启用流式响应。`qwen-plus` 继续用于完整翻译和 refinement。`qwen-turbo` 在本次相同样本测试中满足 mean `<=500ms`、P95 `<=900ms` 和基础质量 `>=90%` 三项门槛；`qwen-plus` 的 mean 为 `608.1ms`，未达到 500ms 强目标。

```dotenv
FAST_DRAFT_MODEL=qwen-turbo
FAST_DRAFT_STREAMING=true
TRANSLATION_MODEL=qwen-plus
```

## 固定样本与环境

| 项目 | 值 |
| --- | --- |
| provider | Aliyun DashScope OpenAI-compatible endpoint |
| endpoint | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 系统 | Windows `10.0.26200` |
| 语音 | Microsoft Zira Desktop，16kHz、16-bit、单声道 WAV |
| 音频时长 | 51,740ms |
| 音频 SHA-256 | `a5e6045b852060c4bd12c1359c63bc2047f7e5ef10f9516336215099c6952911` |
| 样本清单 | `scripts/fixtures/realtime-catch-up-english.json` |
| measured partial | 每个模型 50 个 |
| warm-up | 每个模型 5 个 |
| 调用顺序 | 每个 partial 依次调用 `qwen-turbo`、`qwen-plus` |
| prompt | 生产 fast-draft prompt，`temperature=0.1` |
| 首稿边界 | 生产 `minimumReadableCharacters=6` 规则 |

固定 WAV 由样本清单中的 10 个完整英语句子生成；清单同时保存每句的 5 个渐进 partial，共 50 个互不相同的模型输入。两个候选使用同一输入顺序、endpoint、网络和进程，候选交替执行以降低网络时段偏差。

## 结果

| 模型 | 成功/尝试 | streaming | errors | mean | P50 | P95 | max | 质量通过 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `qwen-turbo` | 50/50 | 50 | 0 | 293.5ms | 302ms | 362ms | 369ms | 46/50（92%） |
| `qwen-plus` | 50/50 | 50 | 0 | 608.1ms | 615ms | 783ms | 918ms | 46/50（92%） |

延迟从请求派发开始，截止到流式文本第一次满足客户端现行六字符可读边界。所有样本均使用真实 provider 流式响应，没有 fallback 或 mock 样本。

## 质量审计

基础质量检查要求输出中文、避免 Markdown/解释包装、保留数字和 `API` 等关键字，并检查音频、字幕、调度、final/history、毫秒、mean/P95、压力恢复和技术术语等语义。90% 门槛用于筛除明显不适合作为字幕草稿的候选；final/refinement 仍负责后续质量修正。

- `qwen-turbo`：3 次把 mean target 误译为“最终目标”，1 次把 history 译为“史册”。
- `qwen-plus`：4 次把 ASR partial translation 译为“局部翻译”。
- “均值/平均”“恢复/缓解”“Qwen/通义千问”“P95/第95百分位”视为等价表达，不计失败。

两者基础质量通过率相同。`qwen-turbo` 的 mean 降低 51.7%，P95 降低 53.8%，并满足 500ms 强目标，因此成为 fast-draft 默认值。

## 复现

```powershell
npm run generate:benchmark-audio
npm run benchmark:fast-draft-models -- --output docs/verification/fast-draft-model-benchmark.json
```

命令会从本地 `.env` 读取 `DASHSCOPE_API_KEY`，每次完整执行产生 110 个真实 provider 请求。API Key 不写入音频、控制台摘要或 JSON 报告。

逐请求的源文、译文、首稿、延迟、质量结果和环境元数据保存在 [JSON 证据](fast-draft-model-benchmark-2026-07-25.json)。该模型基准隔离翻译阶段；完整 reference report 继续负责验证 ASR 音频证据、renderer 可见提交、端到端 P50/P95、active lag 和恢复时间。
