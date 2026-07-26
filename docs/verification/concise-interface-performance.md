# 精简界面性能验证

## 验收原则

精简界面沿用现有 ASR、翻译、润色和调度参数。首稿提交后只进行至多 6 条记录的内存 Map 合并，历史排序、分组、JSON 序列化和 localStorage 写入延迟到浏览器完成下一帧后的批处理任务。

## 改造前基线

- 固定样本：`scripts/fixtures/realtime-catch-up-english.json`
- 确定性命令：`npm run test:timing-harness`
- 真实参考命令：`npm run verify:latency-reference`
- provider 基准命令：`npm run benchmark:fast-draft-models`
- 已有 qwen-turbo 报告：首个可读草稿 mean `293.5ms`、P95 `362ms`
- 环境：Windows，Electron 33，现有 realtime tuning、provider 和模型配置

## 改造后结果

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| 历史 enqueue 阶段 | 不访问 localStorage、不排序、不分组 | 通过 |
| 空历史与 500 条历史确定性首稿路径 | 使用同一 timing harness，历史在可见路径外提交 | 通过 |
| `npm run test:timing-harness` | 见本次验证命令输出 | 通过后方可验收 |
| 真实 provider mean/P50/P95 | 需要相同密钥、模型、网络和固定样本执行至少 3 轮成对测试 | 待环境具备后复验 |

真实 provider 的 mean、P50、P95 均不得高于改造前同条件结果，首稿仍需低于 `1000ms`。公网波动明显时按前后交替顺序重测，并以至少 3 轮统计量的中位数比较。

## 手工检查

- 在 `680x420`、`820x520` 和 `1280x720` 检查工具栏、设置弹层、字幕和历史无重叠。
- 分别在历史收起和展开状态运行同传，确认当前字幕更新节奏一致。
- 使用 500 条历史与连续长段落检查滚动、复制和导出完整性。
- 亮色、暗色和跟随系统主题均需检查错误提示和悬浮字幕可读性。
