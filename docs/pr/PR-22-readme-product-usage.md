# README 产品使用说明更新

## 标题

更新声桥 LinguaBridge 产品使用说明

## 功能描述

本次更新将 README 改为面向真实使用者的中文产品说明，覆盖声桥的适用场景、核心功能、快速启动、真实 API 配置、系统音频使用方式、麦克风 fallback、文件模拟、悬浮字幕、译文播报、支持场景、限制和常见问题。

README 明确说明 OpenAI 可作为完整实时 ASR 与翻译路径，DeepSeek-compatible provider 适合作为文本翻译路径；同时补充 Windows 系统音频捕获、WASAPI loopback helper、Electron desktopCapturer fallback、会议/通话软件限制和真实桌面验证方式。

## 实现范围

- 重写 `README.md`，采用中文产品使用说明风格。
- 新增 `docs/review/dependencies-and-originality.md`，说明第三方依赖、外部服务接口、系统音频捕获边界和原创功能范围。
- README 保留公开可读的后续计划，不包含内部任务清单、私有演示提交说明或实现分批编号。
- OpenSpec 任务清单同步标记本轮 README 与公开文档任务完成。

## 验证方式

- `npm.cmd run build`
- `openspec validate --all`
- 编译并运行 `tests/desktopScenarioVerification.test.ts`
- 密钥扫描：确认 README 和 `.env.example` 只包含占位符，没有真实 API Key

## 影响范围

- `README.md`
- `docs/review/dependencies-and-originality.md`
- `docs/pr/PR-22-readme-product-usage.md`
- `openspec/changes/complete-realtime-desktop-interpretation/tasks.md`
