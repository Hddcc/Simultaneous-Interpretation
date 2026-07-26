## 1. 窗口几何与状态契约

- [x] 1.1 新增 `electron/floatingWindowLayout.ts`，实现高度自适应、宽度分档、偏好归一化与内容偏好合并的纯函数。
- [x] 1.2 扩展 `FloatingCaptionState`，增加 `running` 与 `backdrop`，并在 `electron/main.ts`、`electron/preload.ts`、`types/preload.d.ts` 三处同步。
- [x] 1.3 新增 `tests/floatingCaptionOverlay.test.ts`，覆盖高度上下限与锚边、宽度步进与贴边、偏好归一化与合并不被字幕刷新覆盖。
- [x] 1.4 在 `package.json` 增加 `test:floating` 并接入 `test` 串行链。

## 2. 悬浮窗内会话控制

- [x] 2.1 在 preload 暴露 `sendFloatingCaptionCommand` 与 `onFloatingCaptionCommand`，在主进程实现悬浮窗到主窗口的命令转发。
- [x] 2.2 悬浮字幕控制条增加开始与暂停按钮，按 `running` 切换图标与无障碍标签。
- [x] 2.3 主窗口订阅命令通道并复用既有 `primarySessionAction`，用 ref 持有最新处理函数避免闭包读到旧状态。
- [x] 2.4 主窗口与悬浮窗均设置 `backgroundThrottling: false`，保证主客户端最小化时翻译速度不下降。

## 3. 整句显示与高度自适应

- [x] 3.1 移除源文与译文的单行限制和固定 `max-height`，放宽行数兜底到源文 3 行、译文 6 行。
- [x] 3.2 悬浮模式下让 `html`、`body`、`#root` 高度跟随内容，使窗口高度可缩到内容尺寸。
- [x] 3.3 悬浮窗以 `ResizeObserver` 加合帧与阈值节流上报内容高度，主进程按锚边调整窗口高度。
- [x] 3.4 下调 `BrowserWindow` 的 `minWidth` 与 `minHeight`，避免自适应高度被窗口下限挡住。

## 4. 歌词式透明与鼠标穿透

- [x] 4.1 悬浮窗改为 `transparent`、`hasShadow: false`、`resizable: false`，并在首帧前给 document 打上悬浮窗标记避免背景闪烁。
- [x] 4.2 重写悬浮字幕样式：去除背景板、边框与阴影，改用描边与多层投影，状态语义迁移到状态标签配色。
- [x] 4.3 增加无背景、淡背景、深背景三档切换，并经偏好通道保存到主进程。
- [x] 4.4 实现锁图标切换鼠标穿透，锁定后经 mousemove 转发浮出解锁图标，并在命中区内外翻转时才发送穿透 IPC。
- [x] 4.5 增加宽度分档按钮，宽度调整时固定靠近屏幕的一侧边缘。

## 5. 行高稳定与当前句标记

- [x] 5.1 为上一句、源文、译文分别预留 1、2、3 行，使流式译文在预留空间内增长而不改变窗口高度。
- [x] 5.2 字幕行块改为顶部对齐，避免新增行把第一行整体推走。
- [x] 5.3 渲染上一句淡显文本并始终占位，让当前句以高亮层级区分，且上一句出现时不改变窗口高度。
- [x] 5.4 新增 `src/captions/floatingHeight.ts` 的 `planFloatingHeightRequest`：增高立即生效、降低需稳定约 900ms，并按 `recheckInMs` 唤醒落地待定收缩。
- [x] 5.5 移除字幕行块基于 `vh` 的行间距，避免窗口高度调整反馈回自身测量。
- [x] 5.6 按实测预留高度更新 `getFloatingWindowSize`，使窗口开箱即为稳定尺寸。
- [x] 5.7 为流式增长、回落、再增长的时序补充 `planFloatingHeightRequest` 断言。

## 6. 偏好归属与验证

- [x] 6.1 主进程分离字幕内容与悬浮窗偏好，广播时合并，主窗口不再上报偏好字段。
- [x] 6.2 主客户端解锁字幕与重置位置改为经偏好通道复位，保持兜底能力。
- [x] 6.3 更新 `src/verification/desktopScenarios.ts` 的悬浮字幕与锁定场景，补充窗内开关、整句显示、无背景板与解锁图标检查项。
- [x] 6.4 运行 `npm run build` 与 `npm test` 完成回归。
