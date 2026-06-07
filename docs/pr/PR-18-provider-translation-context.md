# PR 18：接入 provider 翻译与上下文

## 标题

接入 provider 翻译与上下文

## 功能描述

本次更新让稳定的 ASR 片段可以进入真实翻译链路。桌面端在收到 final ASR 片段后，会携带最近的原文和译文上下文请求翻译服务，帮助模型保持术语、称谓和上下文一致。临时片段仍保留本地 mock 译文，保证字幕区域持续有反馈。

翻译结果会记录 provider、模型、上下文数量、翻译延迟和是否使用源文兜底。工作台状态栏同步显示 ASR 延迟、翻译延迟、字幕总延迟以及翻译模型标签，字幕历史中也能看到每条译文的来源模型。

## 实现思路

- Electron 主进程根据 `.env` 中的 `TRANSLATION_PROVIDER` 选择翻译路径。
- `openai` 使用 Responses API，默认模型来自 `TRANSLATION_MODEL`。
- `deepseek` 使用 OpenAI-compatible `chat/completions` 路径，读取 `DEEPSEEK_API_KEY`。
- `custom` 走兼容 `chat/completions` 路径，优先读取 `CUSTOM_TRANSLATION_API_KEY`。
- 渲染进程只通过 preload 暴露的 `translateText` 调用主进程，API key 不进入前端。
- 翻译失败时保留源文作为字幕译文，同时在事件中记录错误信息与 fallback 状态。

## 测试方式

- 运行 `npm.cmd run build`，确认 TypeScript 与前端构建通过。
- 运行 `openspec validate --all`，确认 OpenSpec 变更仍有效。
- 运行 Electron smoke 测试，确认应用可以启动到桌面工作台。
- 搜索 `sk-`、`OPENAI_API_KEY=`、`DEEPSEEK_API_KEY=`，确认没有提交真实密钥。

## 影响范围

- `electron/main.ts`
- `electron/preload.ts`
- `types/preload.d.ts`
- `src/translation/client.ts`
- `src/translation/types.ts`
- `src/App.tsx`
- `src/styles.css`
