# PR 19：实时字幕修订归并

## 标题

实时字幕修订归并

## 功能描述

本次更新将实时字幕的修订逻辑抽成独立归并模块。ASR partial、ASR final、翻译修正、provider 重连恢复和源文兜底都会按同一套规则更新最近字幕片段，保持 segmentId 稳定、修订号递增、历史记录可追溯。

旧字幕超过修订窗口后保持稳定，新的 provider 事件不会继续改写较早记录，避免用户回看历史时内容跳动。

## 实现思路

- 新增 `src/subtitles/reconciliation.ts`，集中处理字幕片段归并。
- 使用 `DEFAULT_REVISION_WINDOW` 控制可修订范围。
- 同 segmentId 的新 ASR/翻译事件会在窗口内原位更新字幕。
- 重复事件不会重复增加修订号。
- 字幕记录新增 `revisionProvenance`，用于标识修订来源：
  - `asr-partial-correction`
  - `asr-finalization`
  - `translation-correction`
  - `provider-reconnect`
  - `manual-fallback`
- 工作台状态栏和历史记录显示最近修订来源。

## 测试方式

- `npm.cmd run build`
- `openspec validate --all`
- 编译并执行 `tests/subtitleReconciliation.test.ts`
- Electron 短启动 smoke：临时清除 `ELECTRON_RUN_AS_NODE` 后启动应用 3 秒并关闭
- 密钥扫描：确认没有真实 API key 被提交

## 影响范围

- `src/subtitles/reconciliation.ts`
- `src/App.tsx`
- `src/asr/types.ts`
- `src/asr/client.ts`
- `src/translation/types.ts`
- `src/styles.css`
- `tests/subtitleReconciliation.test.ts`
