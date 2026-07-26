## Why

真实翻译请求失败或被取消时，当前客户端会把源语言原文写入 `translatedText`，导致“英语 -> 中文”界面把完整英文伪装成成功译文。与此同时，音频心跳会快速清除翻译错误，使用户和诊断工具无法判断字幕仍在等待、已经失败或正在恢复。

## What Changes

- 将翻译失败、请求取消和有效译文结果建模为不同结果，禁止失败路径把源文本提交为译文。
- 在提交译文前按当前语言方向执行轻量目标语言校验，并将明显未翻译的结果视为可恢复失败。
- 对 final 字幕执行一次有界恢复翻译；恢复请求使用完整翻译模型，且不阻塞更新中的 active partial。
- 翻译失败时保留最近有效译文或明确的等待/失败状态，避免原文覆盖译文槽位和历史记录。
- 让翻译错误持续到成功恢复、用户重试或会话重置，并记录 provider、model、HTTP/服务错误与重试结果。
- 补充 provider 异常、取消竞争、目标语言不匹配、final 恢复和错误生命周期的回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `realtime-interpretation-pipeline`: 明确有效译文判定、失败结果语义、final 有界恢复以及可诊断错误元数据。
- `desktop-caption-experience`: 明确翻译等待、失败和恢复时主字幕、悬浮字幕及历史记录的展示行为。

## Impact

- 受影响代码主要包括 `src/translation/client.ts`、`src/translation/types.ts`、`src/translation/scheduler.ts`、`src/subtitles/reconciliation.ts`、`src/captions/cue.ts`、`src/App.tsx` 和 `electron/main.ts`。
- Electron preload 的翻译响应契约可能增加结构化失败或错误元数据，但不向 renderer 暴露密钥。
- 不新增第三方依赖，不增加用户配置项，不改变现有语言选择、音频采集和 provider 配置方式。
- 现有成功译文、低延迟 partial、历史 backfill 和 refinement 行为保持兼容。
