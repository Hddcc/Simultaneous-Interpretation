## 1. 回归测试与类型契约

- [x] 1.1 在翻译客户端测试中复现 provider 异常和源文回显，断言失败结果不包含可见原文译文，并覆盖英语到中文、中文到英语、混合术语、数字、缩写和专名校验边界。
- [x] 1.2 在流式与 IPC 测试中覆盖 stale partial 取消、非取消 provider 错误和结构化错误元数据，断言取消结果不会进入字幕或用户错误状态。
- [x] 1.3 在 scheduler 测试中覆盖 final 首次失败、一次恢复成功、恢复失败不循环、active partial 优先以及 recovery 去重。
- [x] 1.4 在 reconciliation、cue 和 history 测试中覆盖失败不覆盖有效译文、无有效译文不复制源文、历史恢复原位更新和 refinement 跳过无效译文。
- [x] 1.5 为翻译 issue 生命周期补充聚焦测试，验证音频 chunk 不清除错误、成功恢复和会话/语言重置会清除错误。

## 2. Provider 与翻译客户端失败语义

- [x] 2.1 扩展 Electron、preload 和 renderer 类型，定义可序列化且不含密钥的翻译失败元数据，并区分成功、取消和 provider 失败。
- [x] 2.2 修改 Electron 翻译处理器，使取消传播为可识别的 abort，移除用 `request.text` 构造成功响应的路径，并提取 HTTP 状态与 provider 错误码。
- [x] 2.3 实现轻量目标语言校验并应用于完整响应和流式草稿，仅拦截具有明确源语言信号的明显未翻译结果。
- [x] 2.4 修改翻译客户端，使异常或校验失败产生空可见译文的失败事件，同时保留 provider、model、失败类别和诊断时间。

## 3. Final 恢复与字幕提交

- [x] 3.1 扩展低延迟调度器，为无有效译文的 final revision 安排一次去重恢复，使用完整翻译模型和有界 backfill 容量，并保持 active partial 优先。
- [x] 3.2 为 final recovery 增加成功、失败、跳过和队列深度诊断，确保失败和 fallback 样本不计入成功延迟指标。
- [x] 3.3 更新 subtitle reconciliation 与 caption cue，只用有效译文更新可见文本；失败事件保留已有译文或空状态，并允许恢复结果按 active/history 位置原位提交。
- [x] 3.4 收紧 refinement 入队条件，阻止空译文、provider 失败和目标语言校验失败结果进入润色，恢复成功后继续沿用现有 final refinement。

## 4. 错误生命周期与桌面展示

- [x] 4.1 将翻译 issue 与音频采集 `session.error` 分离，按 segment/revision 保存错误，并在有效译文、用户重试、会话重启、语言变化或 reset 时清除。
- [x] 4.2 更新主字幕和悬浮字幕派生状态，分别显示等待、保留旧译文、恢复中和恢复失败，禁止使用源文本填充译文槽位。
- [x] 4.3 更新历史记录投影、分组和渲染，使无有效译文的 final 保留源文及不可用状态，后续恢复译文能够更新同一历史记录。
- [x] 4.4 扩展内部诊断快照，记录失败类别、provider、model、HTTP/服务错误码、首次/最近失败时间及 final recovery 结果，并确认敏感配置不会进入 renderer 或本地历史。

## 5. 验证与交付

- [x] 5.1 运行翻译、流式、scheduler、caption、history、refinement、diagnostics 和状态聚焦测试，确认新增回归场景全部通过。
- [x] 5.2 运行 `npm test`、`npm run build` 和 `openspec validate prevent-untranslated-caption-fallback --strict`。
- [x] 5.3 使用真实 Qwen 对英语到中文执行正常响应、源文回显模拟、provider 失败和 final 恢复冒烟验证，确认主字幕、悬浮字幕和历史均不再把英文原文显示为中文译文。
