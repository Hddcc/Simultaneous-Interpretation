# Add README and demo deliverables

## 功能描述

本次变更新增面向评审和使用者的中文 README，并将产品名统一为“声桥 LinguaBridge”。README 覆盖适用场景、当前能力、快速体验、运行命令、环境变量、常见问题、技术栈和原创功能。

## 实现思路

- 重写 README，使其适合评审和普通用户快速理解项目。
- 将窗口标题、主界面标题和说明文案统一到“声桥 LinguaBridge”。
- 在 README 中保留技术栈、核心能力、配置说明和常见问题。
- 移除面向内部提交准备的资料引用，公开说明保持产品使用视角。

## 验证方式

- 运行 `npm run build`，确认项目仍可构建。
- 运行 `openspec validate --all`，确认 OpenSpec 变更有效。
- 检查 README 是否保持中文产品说明风格。
- 检查 README 中未出现面向任务拆分的编号描述。
- 检查 README 中未暴露内部提交资料路径。

## 待补材料

真实演示视频由本地环境单独录制和提交，仓库 README 只保留公开使用说明。
