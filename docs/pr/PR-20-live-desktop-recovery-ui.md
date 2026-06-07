# PR 20：实时桌面体验与恢复界面

## 标题

实时桌面体验与恢复界面

## 功能描述

本次更新为桌面工作台补齐实时链路状态和恢复操作。应用会把本地输入状态、provider 会话状态、队列压力和系统音频能力统一归并为 live 状态，用于显示捕获中、连接中、流式运行、重连中、降级运行、异常和已停止。

主工作台新增恢复提示和操作按钮。用户在捕获或 provider 异常时仍能停止输入、重试当前来源，或切换备用输入继续验证。悬浮字幕窗口会同步显示紧凑状态，并在降级或异常时保留最新可用字幕。

## 实现思路

- 新增 `src/liveExperience/state.ts`，集中派生 live 状态、严重级别、恢复建议和可用操作。
- 扩展 `StreamStatus`，新增 `stopped`。
- 扩展 `FloatingCaptionState`，新增 `compactStatusLabel` 和 `severity`。
- 主工作台状态 pill、状态栏、字幕区恢复提示和恢复按钮统一使用 live 状态。
- 悬浮字幕窗口按 severity 调整视觉状态，保持 latest useful subtitle 可读。
- CSS 增加按钮 disabled、warning/error、恢复提示和小屏响应式布局。

## 测试方式

- `npm.cmd run build`
- `openspec validate --all`
- 编译并执行 `tests/liveExperienceState.test.ts`
- Electron 短启动 smoke：临时清除 `ELECTRON_RUN_AS_NODE` 后启动应用 3 秒并关闭
- 密钥扫描：确认没有真实 API key 被提交

## 影响范围

- `src/liveExperience/state.ts`
- `src/App.tsx`
- `src/audio/types.ts`
- `src/styles.css`
- `electron/main.ts`
- `electron/preload.ts`
- `types/preload.d.ts`
- `tests/liveExperienceState.test.ts`
