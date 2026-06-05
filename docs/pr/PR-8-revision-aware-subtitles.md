# Add revision-aware subtitle updates

## 功能描述

本次变更新增版本化字幕修订能力。应用会用稳定的 `segmentId` 保存字幕片段，识别或翻译结果更新时，最近字幕会在原位置修正，并展示版本号和修订原因。

用户在观看字幕时可以看到临时字幕、已修订字幕和最终译文之间的变化。右侧字幕记录会保留版本、上下文数量、延迟和修订原因。

## 实现思路

- 扩展 `SubtitleSegment` 和 `TranslationEvent`，增加 `partial`、`final`、`revised` 状态、修订原因和 `revised` 标记。
- ASR partial 和 final 事件都进入字幕合并逻辑，后续事件通过同一个 `segmentId` 更新已有字幕。
- 新增最近修订窗口，当前窗口为最近 4 条字幕；窗口外字幕保持原显示内容。
- UI 对已修订字幕增加轻量边框和历史状态提示，降低阅读干扰。
- README 继续按中文产品使用说明更新，说明修订行为和当前能力。

## 验证方式

- 运行 `npm run build`，确认 TypeScript、Electron 主进程和 Vite 构建通过。
- 运行 Electron smoke test，确认桌面应用可以启动并保持运行。
- 运行 `openspec validate --all`，确认 OpenSpec 变更仍然有效。
- 启动应用后，使用文件模拟或麦克风输入观察字幕从临时版本更新到修订版本。

## 范围说明

本次只实现主工作台内的字幕修订模型、修订窗口和 UI 提示。悬浮字幕窗口、TTS 和最终 demo 文档会在后续独立变更中完成。
