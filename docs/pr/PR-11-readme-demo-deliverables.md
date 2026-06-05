# Add README and demo deliverables

## 功能描述

本次变更新增面向评审的中文 README、演示脚本、视频提交入口和依赖归属说明。README 使用“声桥 LinguaBridge”作为产品名，覆盖适用场景、当前能力、快速体验、运行命令、环境变量、常见问题、技术栈和原创功能。

## 实现思路

- 重写 README，使其适合评审和普通用户快速理解项目。
- 新增 `docs/demo/demo-script.md`，给出演示视频的镜头顺序和操作步骤。
- 新增 `docs/demo/video-submission.md`，记录视频文件或公开视频链接的提交入口。
- 新增 `docs/review/dependencies-and-originality.md`，区分第三方依赖、系统能力和原创实现。

## 验证方式

- 运行 `npm run build`，确认项目仍可构建。
- 运行 `openspec validate --all`，确认 OpenSpec 变更有效。
- 检查 README 是否保持中文产品说明风格。
- 检查 README 中未出现面向任务拆分的编号描述。

## 待补材料

真实演示视频需要在桌面环境中录制。录制完成后，将视频放入 `docs/demo/` 或在 `docs/demo/video-submission.md` 填写公开视频链接。
