# PR 21：桌面场景验证清单

## 标题

桌面场景验证清单

## 功能描述

本次更新补齐真实桌面同传场景的验证材料。项目新增浏览器视频、会议软件、通话软件、麦克风 fallback、悬浮字幕覆盖其他应用、可选译文语音播报六类场景的结构化验证定义，并提供中文验证清单。

浏览器、会议和通话场景需要在 Windows 桌面环境中手工执行。文档明确每个场景的准备步骤、通过标准、fallback 路径和证据记录方式，便于后续 README 和最终提交说明引用真实验证结果。

## 实现思路

- 新增 `src/verification/desktopScenarios.ts`，用结构化数据描述桌面场景。
- 新增 `docs/verification/desktop-scenarios.md`，提供中文产品化验证步骤和结果记录模板。
- 新增 `tests/desktopScenarioVerification.test.ts`，确保核心场景、预期信号、证据记录和 fallback 路径完整。
- OpenSpec 任务清单同步标记桌面场景验证任务完成。

## 测试方式

- `npm.cmd run build`
- `openspec validate --all`
- 编译并执行 `tests/desktopScenarioVerification.test.ts`
- 继续执行字幕修订与 live 状态测试，确认新增验证模块不影响现有功能
- Electron 短启动 smoke：临时清除 `ELECTRON_RUN_AS_NODE` 后启动应用 3 秒并关闭
- 密钥扫描：确认没有真实 API key 被提交

## 影响范围

- `src/verification/desktopScenarios.ts`
- `tests/desktopScenarioVerification.test.ts`
- `docs/verification/desktop-scenarios.md`
- `openspec/changes/complete-realtime-desktop-interpretation/tasks.md`
