# 同声传译简洁界面 - 详细实施计划

> 本文档根据需求资料和当前项目代码编写。
> 核心思路：保留实时业务状态和处理函数，用单栏工具壳、折叠历史与设置弹层替换现有工作台布局。；共享跨平台产品层，按现有系统音频能力分级验证，Windows 作为完整桌面同传目标平台。；实时字幕先完成可见提交，再将精简记录放入待写队列；历史在首帧之后持久化，并仅按会话、来源、语言方向和 8 秒间隔投影成段落。；首稿可见提交拥有最高优先级，新增历史工作延迟批处理，并通过改造前后同条件对比实施零回退性能门禁。

---

## 设计决策（Q&A）

### Q1：主界面如何精简，同时保留核心操作和必要设置？

采用单栏紧凑工具布局。顶部只放语言方向、暂停/继续、历史和设置；中部展示最近上下文、当前原文和突出译文；历史从底部默认收起；音频源、设备或文件、字体、主题、悬浮字幕与 TTS 收进设置弹层。

> 选择理由：当前 App.tsx 已经具备全部行为入口，主要问题集中在信息架构和视觉密度。保留事件处理函数并替换 JSX/CSS，可以控制风险并满足极简工具目标。

> 复用结论：复用 App.tsx 中的语言切换、采集控制、错误提示、悬浮字幕和 TTS 函数；复用现有 Electron 窗口和 preload 接口。

### Q2：本次多端支持如何定义验收范围？

Windows 验收系统音频、麦克风和文件三类输入；macOS/Linux 验收同一界面、历史、语言切换、麦克风、文件和 Electron desktopCapturer fallback。原生系统播放声等价能力留作独立后续需求。

> 选择理由：当前仓库只有 Windows WASAPI helper 能力检测，macOS/Linux 没有等价原生采集实现。将原生补齐纳入本次会显著扩大范围并偏离轻量界面核心目标。

> 复用结论：复用 nativeAudioCapability、desktopCapturer、麦克风和文件输入 fallback。

### Q3：历史如何做到跨会话可回溯、可修订且按用户期望连续成段？

新增 renderer 本地历史模块，以会话 ID 和 segment ID 组成稳定键，最多保存 500 条。每次字幕产生或修订时原位 upsert；同一会话、来源和语言方向内，仅当相邻记录间隔超过 8 秒时另起一段，不设置句数上限。

> 选择理由：用户需要完整连续段落，固定句数会人为切断语义。来源、语言方向和会话变化仍然形成自然边界，8 秒静默作为同一会话中的时间边界。

> 复用结论：复用 SubtitleSegment、formatTimestamp、revisionProvenance 和最近 3 条上下文逻辑；HistoryRecord 只保存产品界面需要的字段。

### Q4：界面和历史改造完成后，如何保证同传速度不慢于改造前？

性能作为阻断式验收项。实现前保存同一固定样本、配置和机器下的首稿可见延迟与端到端延迟基线；实现后用相同条件重复测试。确定性 timing harness 的各项延迟不得增加，真实 provider 的成对多轮测试中 mean、P50 和 P95 均不得高于改造前基线，同时继续满足首稿低于 1 秒的产品门槛。

> 选择理由：现有 qwen-turbo fast-draft 已有 mean 293.5ms、P95 362ms 的 provider 基准。界面改造的主要性能风险来自 renderer 同步计算和 localStorage 写入，因此需要从代码路径和测量门槛两侧约束。

> 复用结论：完整复用 startSession、translationScheduler、refinementScheduler、reconcileSubtitleSegments、SessionLatencyAggregator、ProviderLatencyReferenceRunner 和现有固定样本。

---

## 改动总览

| 序号 | 文件或平台 | 改动类型 | 说明 |
|---|---|---|---|
| 1 | `src/App.tsx` | 修改 | 移除侧边栏和多面板工作台，增加紧凑工具栏、设置弹层、最近上下文和折叠历史入口。 |
| 2 | `src/styles.css` | 修改 | 重建单栏响应式布局、主题变量、字号档位、弹层和折叠历史样式。 |
| 3 | `electron/main.ts` | 修改 | 将主窗口默认尺寸调整为 820×520、最小尺寸调整为 680×420。 |
| 4 | `package.json` | 修改 | 增加 lucide-react，使用标准工具图标并补充历史测试脚本。 |
| 5 | `README.md` | 修改 | 更新轻量界面使用方式和 Windows/macOS/Linux 能力矩阵。 |
| 6 | `docs/verification/desktop-scenarios.md` | 修改 | 补充平台分级验收步骤。 |
| 7 | `src/history/types.ts` | 新增 | 定义 HistoryRecord、HistoryStore 和 HistoryGroup。 |
| 8 | `src/history/storage.ts` | 新增 | 实现版本校验、读取、upsert、500 条裁剪、清空和文本序列化。 |
| 9 | `src/history/grouping.ts` | 新增 | 实现只以会话、来源、语言方向和 8 秒间隔为边界的连续段落分组。 |
| 10 | `src/history/deferredWriter.ts` | 新增 | 实现首稿渲染后的合并写入队列和 beforeunload 冲刷，避免阻塞实时字幕。 |
| 11 | `src/App.tsx` | 修改 | 生成 captureSessionId，将字幕修订放入延迟历史队列，并接入复制、导出和清空操作。 |
| 12 | `electron/main.ts` | 修改 | 新增 TXT 保存对话框和 UTF-8 文件写入 IPC。 |
| 13 | `electron/preload.ts` | 修改 | 暴露 exportSubtitleHistory。 |
| 14 | `types/preload.d.ts` | 修改 | 声明历史导出 IPC 类型。 |
| 15 | `tests/historyStorage.test.ts` | 新增 | 覆盖读取、upsert、修订覆盖、裁剪、损坏数据回退和文本序列化。 |
| 16 | `tests/historyGrouping.test.ts` | 新增 | 覆盖会话、来源、语言和 8 秒分组边界，并验证连续任意句数保持同段。 |
| 17 | `tests/historyDeferredWriter.test.ts` | 新增 | 覆盖合并写入、首稿路径不执行存储和关闭前冲刷。 |
| 18 | `src/App.tsx` | 修改 | 当前字幕先更新，历史只 enqueue；移除首稿路径中的同步持久化和全量分组。 |
| 19 | `src/history/deferredWriter.ts` | 新增 | 首帧后批量写历史，关闭前冲刷。 |
| 20 | `tests/realtimeTimingHarness.test.ts` | 修改 | 加入开启 500 条历史后的首稿可见延迟零增加场景。 |
| 21 | `tests/historyDeferredWriter.test.ts` | 新增 | 证明 enqueue 不执行 localStorage、排序或分组。 |
| 22 | `docs/verification/concise-interface-performance.md` | 新增 | 保存改造前后环境、命令、报告和对比结论。 |

---

## 步骤 1：替换主工作台布局

**文件**：`src/App.tsx`

**位置**：App 返回的主窗口 JSX，当前约 2001 行

删除 client-sidebar、diagnostics 分支、重试按钮、status pill、延迟和 transport bar；新增 compact-toolbar、caption-stage、history-panel 和 settings-popover。

**当前代码**：
```tsx
<main className="app-shell">
  <aside className="client-sidebar">...</aside>
  <section className="client-main">
    <header className="client-toolbar">...</header>
    <section className="client-content">...</section>
    <footer className="transport-bar">...</footer>
  </section>
</main>
```

**修改后代码**：
```tsx
<main className={`lite-shell theme-${theme} font-${fontSize}`} aria-labelledby="app-title">
  <header className="compact-toolbar">
    <h1 id="app-title">声桥</h1>
    <select value={activeLanguagePair.id} onChange={(event) => updateLanguagePair(event.target.value)}>{languageOptions}</select>
    <button type="button" className="primary-action" onClick={primarySessionAction}>{isSessionRunning ? "暂停" : "继续"}</button>
    <button type="button" aria-label="字幕历史" title="字幕历史" onClick={() => setHistoryExpanded((value) => !value)}><History /></button>
    <button type="button" aria-label="设置" title="设置" onClick={() => setSettingsOpen((value) => !value)}><Settings /></button>
  </header>
  {settingsOpen ? <SettingsPopover /> : null}
  <section className="caption-stage" aria-live="polite">
    <RecentContext groups={recentContextGroups} />
    <p className="source-caption">{activeSourceText}</p>
    <p className="translated-caption">{activeTranslatedText}</p>
    {session.error ? <p className="error-message">{session.error}</p> : null}
  </section>
  <HistoryPanel expanded={historyExpanded} groups={historyGroups} />
</main>
```

**执行说明**：

- History、Settings 等按钮使用 lucide-react 图标并提供 aria-label/title。
- 错误仅在发生时显示面向用户的可恢复说明，不显示内部队列或 provider 术语。

---

## 步骤 2：增加精简设置状态

**文件**：`src/App.tsx`

**位置**：App 顶部 useState 区域与原 settings panel

用 localStorage 保存 system/light/dark 主题和 small/medium/large 字号；设置弹层复用现有来源、设备、文件、悬浮字幕与 TTS 操作。

**当前代码**：
```tsx
const [activePanel, setActivePanel] = useState<ClientPanel>("history");
```

**修改后代码**：
```tsx
const [historyExpanded, setHistoryExpanded] = useState(false);
const [settingsOpen, setSettingsOpen] = useState(false);
const [theme, setTheme] = useState<UiTheme>(loadUiTheme);
const [fontSize, setFontSize] = useState<UiFontSize>(loadUiFontSize);
```

**执行说明**：

- 设置只保留音频源、对应设备或文件、字体、主题、悬浮字幕开关和 TTS 开关。
- 悬浮字幕的解锁与重置作为次级操作展示。

---

## 步骤 3：重写主窗口视觉布局

**文件**：`src/styles.css`

**位置**：client 主窗口样式与响应式区间

以 CSS 变量实现亮/暗/跟随系统主题，以固定字号档位控制字幕；主窗口保持稳定工具栏高度和字幕区域，历史展开时内部滚动。

**当前代码**：
```css
.app-shell { display: grid; grid-template-columns: 188px minmax(0, 1fr); }
.client-content { display: grid; grid-template-columns: minmax(0, 1fr) 340px; }
```

**修改后代码**：
```css
.lite-shell { min-width: 0; min-height: 100vh; display: grid; grid-template-rows: 64px minmax(220px, 1fr) auto; background: var(--surface); color: var(--text); }
.compact-toolbar { display: grid; grid-template-columns: auto minmax(150px, 220px) auto 40px 40px; align-items: center; gap: 12px; padding: 10px 16px; }
.history-panel { max-height: min(44vh, 360px); overflow: auto; border-top: 1px solid var(--border); }
```

**执行说明**：

- 历史条目用分隔线组织，避免嵌套卡片。
- 移动端宽度下工具栏允许换行，按钮保持固定尺寸。

---

## 步骤 4：缩小桌面主窗口

**文件**：`electron/main.ts`

**位置**：createMainWindow

调整默认与最小窗口尺寸，保留用户缩放能力和现有安全配置。

**当前代码**：
```typescript
width: 1120,
height: 720,
minWidth: 960,
minHeight: 600,
```

**修改后代码**：
```typescript
width: 820,
height: 520,
minWidth: 680,
minHeight: 420,
```

---

## 步骤 5：更新平台能力矩阵

**文件**：`README.md`

**位置**：支持场景与限制

明确 Windows 三类输入为完整支持，macOS/Linux 的系统音频使用 Electron fallback，麦克风、文件、UI 和历史保持一致。

**当前代码**：
```markdown
系统音频的完整覆盖优先面向 Windows。
```

**修改后代码**：
```markdown
| 平台 | 系统音频 | 麦克风 | 文件 | 界面与历史 |
| --- | --- | --- | --- | --- |
| Windows | 完整验收，WASAPI 能力检测 + Electron fallback | 支持 | 支持 | 支持 |
| macOS | Electron desktopCapturer fallback，受系统权限限制 | 支持 | 支持 | 支持 |
| Linux | Electron desktopCapturer fallback，受桌面环境限制 | 支持 | 支持 | 支持 |
```

**执行说明**：

- Web 版和 macOS/Linux 原生 loopback 不列入本次实现。

---

## 步骤 6：定义历史数据结构

**文件**：`src/history/types.ts`

**位置**：新文件

保存持久化所需的最小字段，并将展示段落定义为纯派生结构。

**当前代码**：
```typescript
当前无独立历史数据结构，界面直接读取 SubtitleSegment[]。
```

**修改后代码**：
```typescript
export interface HistoryRecord {
  id: string;
  sessionId: string;
  segmentId: string;
  sourceType: AudioSourceType;
  languagePairId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  translatedText: string;
  startedAtMs: number;
  endedAtMs: number;
  updatedAtMs: number;
  revised: boolean;
}

export interface HistoryStore { version: 1; records: HistoryRecord[]; }

export interface HistoryGroup {
  id: string;
  startedAtMs: number;
  endedAtMs: number;
  sourceText: string;
  translatedText: string;
  revised: boolean;
  records: HistoryRecord[];
}
```

**执行说明**：

- 不持久化 provider、模型、队列和延迟等技术字段。
- 持久化键为 sessionId:segmentId，修订事件覆盖原记录。

---

## 步骤 7：实现本地仓储与容量控制

**文件**：`src/history/storage.ts`

**位置**：新文件

使用 lingua-bridge.subtitle-history.v1 作为 key；解析失败返回空历史；按 updatedAtMs 倒序保留 500 条。

**当前代码**：
```typescript
当前没有字幕历史 localStorage 读写。
```

**修改后代码**：
```typescript
const HISTORY_KEY = "lingua-bridge.subtitle-history.v1";
export const HISTORY_LIMIT = 500;

export function upsertHistoryRecords(current: HistoryRecord[], incoming: HistoryRecord[]): HistoryRecord[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, HISTORY_LIMIT);
}

export function saveHistory(records: HistoryRecord[]): void {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, records } satisfies HistoryStore));
}
```

**执行说明**：

- loadHistory 校验 version、数组和关键字段。
- localStorage 写入失败时保留当前内存历史并显示简短错误。

---

## 步骤 8：仅按 8 秒间隔聚合连续段落

**文件**：`src/history/grouping.ts`

**位置**：新文件

记录按开始时间正序扫描；会话、来源或语言方向变化时另起一组；同一边界内只有相邻间隔大于 8 秒才另起一组，连续句数不设上限。

**当前代码**：
```typescript
subtitleSegments.slice(0, 4).map((segment) => ...)
```

**修改后代码**：
```typescript
export const HISTORY_GROUP_GAP_MS = 8_000;

export function groupHistoryRecords(records: HistoryRecord[]): HistoryGroup[] {
  const ordered = [...records].sort((a, b) => a.startedAtMs - b.startedAtMs);
  const groups: HistoryGroup[] = [];
  for (const record of ordered) {
    const current = groups.at(-1);
    const previous = current?.records.at(-1);
    const canMerge = Boolean(previous && previous.sessionId === record.sessionId && previous.sourceType === record.sourceType && previous.languagePairId === record.languagePairId && record.startedAtMs - current!.endedAtMs <= HISTORY_GROUP_GAP_MS);
    canMerge ? appendRecord(current!, record) : groups.push(createGroup(record));
  }
  return groups.reverse();
}
```

**执行说明**：

- 任何连续句数都保持同段。
- 超长段落由历史面板换行和内部滚动承载，复制与导出保留完整内容。
- 最近上下文取最新三个已完成分组，当前 active segment 不重复出现。

---

## 步骤 9：将持久化移出首稿可见路径

**文件**：`src/history/deferredWriter.ts`

**位置**：新文件

首稿提交时只把最多 6 条变更合并到内存 Map；通过 requestAnimationFrame 后的 250ms 合并任务执行裁剪、状态更新和 localStorage 写入；beforeunload 同步冲刷剩余记录。

**当前代码**：
```typescript
原方案计划在 setSubtitleSegments 更新函数内直接 upsert 并调用 localStorage。
```

**修改后代码**：
```typescript
export function createDeferredHistoryWriter(options: HistoryWriterOptions): DeferredHistoryWriter {
  const pending = new Map<string, HistoryRecord>();
  let frameId: number | null = null;
  let timerId: number | null = null;

  function flush(): void {
    const incoming = [...pending.values()];
    pending.clear();
    if (incoming.length) options.commit(incoming);
  }

  return {
    enqueue(records) {
      records.forEach((record) => pending.set(record.id, record));
      if (frameId !== null || timerId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        timerId = window.setTimeout(() => { timerId = null; flush(); }, 250);
      });
    },
    flush
  };
}
```

**执行说明**：

- enqueue 不做排序、JSON 序列化或 localStorage 写入。
- App 卸载和 beforeunload 调用 flush，兼顾持久性。
- 历史默认收起，初次 load/parse 也放在首帧之后执行。

---

## 步骤 10：同步实时字幕到延迟历史队列

**文件**：`src/App.tsx`

**位置**：subtitleSegments 状态、commitTranslationEvent、publishRefinementEvents 和 resetAsrState 周边

reconcileSubtitleSegments 返回后立即更新实时字幕；随后仅映射有译文的变更并 enqueue。实际历史 state、分组和存储在延迟 writer 的 commit 中完成。

**当前代码**：
```tsx
setSubtitleSegments((current) => {
  const { segments: nextSegments } = reconcileSubtitleSegments(...);
  subtitleSegmentsRef.current = nextSegments;
  return nextSegments;
});
```

**修改后代码**：
```tsx
setSubtitleSegments((current) => {
  const { segments: nextSegments } = reconcileSubtitleSegments(...);
  subtitleSegmentsRef.current = nextSegments;
  historyWriterRef.current.enqueue(nextSegments.filter((item) => item.translatedText.trim()).map((item) => toHistoryRecord(item, captureSessionIdRef.current, activeLanguagePair.id, session.sourceType)));
  return nextSegments;
});
```

**执行说明**：

- captureSessionId 在首次开始时创建，暂停/继续沿用；切换来源或语言时创建新 ID。
- resetAsrState 只清实时状态，不清持久历史。

---

## 步骤 11：接入复制与 TXT 导出

**文件**：`electron/main.ts`

**位置**：dialog IPC handlers

复制优先使用 navigator.clipboard；导出通过主进程 showSaveDialog 和 writeFile，以 UTF-8 写入用户选定路径。

**当前代码**：
```typescript
ipcMain.handle("dialog:select-local-media-file", async () => { ... });
```

**修改后代码**：
```typescript
ipcMain.handle("dialog:export-subtitle-history", async (_event, content: string, suggestedName: string) => {
  const result = await dialog.showSaveDialog({ defaultPath: suggestedName, filters: [{ name: "Text", extensions: ["txt"] }] });
  if (result.canceled || !result.filePath) return false;
  await writeFile(result.filePath, content, "utf8");
  return true;
});
```

**执行说明**：

- 导出文本按时间正序，每段包含时间、原文和译文，段落间空一行。
- 文件路径和内容不进入 reqflow 归档或日志。

---

## 步骤 12：固化改造前性能基线

**文件**：`docs/verification/concise-interface-performance.md`

**位置**：实现前基线章节

在改业务代码前运行固定 timing harness、reference report 和 fast-draft 样本，记录模型、配置、样本、机器、mean/P50/P95/max、active lag 和恢复时间。

**当前代码**：
```markdown
已有 docs/verification/fast-draft-model-benchmark-2026-07-25.md 记录 qwen-turbo mean 293.5ms、P95 362ms，但尚无本次界面改造的成对前后报告。
```

**修改后代码**：
```markdown
## 改造前基线

- 固定样本：scripts/fixtures/realtime-catch-up-english.json
- 命令：npm run test:timing-harness；npm run verify:latency-reference；npm run benchmark:fast-draft-models
- 指标：firstDraftVisible、fastDraft、endToEnd、mean、P50、P95、max、activeLag、recoveryMs
- 环境：记录 OS、CPU、Electron、provider、模型和关键 tuning。
```

**执行说明**：

- 真实 provider 测试需用户本地密钥和网络；密钥不写入报告。
- 若无法使用公网 provider，确定性 timing harness 仍是必过硬门槛，真实基准标记为待具备环境后验收。

---

## 步骤 13：保护首稿可见关键路径

**文件**：`src/App.tsx`

**位置**：commitTranslationEvent 与 publishRefinementEvents

保持当前 latency record、setTranslationEvents、setSubtitleSegments 和 syncCaptionCueSnapshot 顺序；新增历史逻辑仅调用 O(变更条数) 的 enqueue，排序、分组、JSON 和 localStorage 延后。

**当前代码**：
```typescript
commitTranslationEvent 在收到译文后记录可见时间并更新 translation/subtitle/caption 状态。
```

**修改后代码**：
```typescript
commitVisibleTranslation(event);
historyWriterRef.current.enqueue(toChangedHistoryRecords(event));
// enqueue 只写内存 Map，持久化由首帧后的合并任务完成。
```

**执行说明**：

- 不在首稿路径读取 500 条历史。
- 历史面板关闭时不执行段落 DOM 渲染。

---

## 步骤 14：执行改造后零回退对比

**文件**：`docs/verification/concise-interface-performance.md`

**位置**：改造后对比与结论章节

相同机器、配置、样本和模型下重复基线命令。确定性报告逐项不得增加；真实 provider 至少执行 3 轮成对测试，取各轮统计量中位数，mean/P50/P95 均不得高于改造前对应值。

**当前代码**：
```markdown
当前没有本次界面改造后的性能对比。
```

**修改后代码**：
```markdown
| 指标 | 改造前 | 改造后 | 差值 | 结论 |
| --- | ---: | ---: | ---: | --- |
| fast-draft mean | baseline | result | result-baseline | 必须 <= 0 |
| fast-draft P50 | baseline | result | result-baseline | 必须 <= 0 |
| fast-draft P95 | baseline | result | result-baseline | 必须 <= 0 |
| end-to-end P50 | baseline | result | result-baseline | 必须 <= 0 |
| end-to-end P95 | baseline | result | result-baseline | 必须 <= 0 |
| active lag | baseline | result | result-baseline | 必须 <= 0 |
```

**执行说明**：

- 若真实 provider 出现环境噪声导致变慢，先重复成对测量并排除网络差异；仍然变慢则优化或回退相关实现。
- 改造后仍需满足产品绝对门槛：首稿 <1000ms，理想 <=800ms。

---

## 配置文件调整

- 新增 lingua-bridge.ui-theme 与 lingua-bridge.ui-font-size 两个 renderer localStorage key，不增加环境变量。
- 新增 localStorage key lingua-bridge.subtitle-history.v1；容量固定为 500 条，不增加句数分段配置。
- 沿用现有 realtime tuning、provider、ASR、translation 和 fast-draft 配置，不增加会改变延迟的配置项。

---

## PB 协议调整

- 本需求不涉及

---

## 无极表调整

- Windows、macOS、Linux 共用同一 React 布局和本地界面偏好。
- Windows：系统音频、麦克风、文件完整验收。
- macOS/Linux：共享界面和历史，系统音频按 Electron fallback 验收。
- localStorage、clipboard 与保存对话框均复用 Electron 跨平台能力。
- Windows 作为完整性能验收平台；macOS/Linux 执行可用输入路径的确定性与 smoke 性能检查。

---

## 数据流总结

用户操作工具栏或设置弹层 -> 复用现有 App 事件处理函数 -> 音频/provider 状态更新 -> 当前字幕区域刷新。

平台能力检测 -> 设置弹层展示可用来源 -> 复用现有捕获或 fallback -> 统一字幕与历史链路。

ASR/翻译事件 -> reconcileSubtitleSegments -> 立即更新当前字幕 -> enqueue 精简 HistoryRecord。

首稿完成渲染 -> 合并延迟任务 -> upsert/cap 500 -> localStorage -> HistoryRecord state。

HistoryRecord state -> 按会话/来源/语言/8 秒间隔分组 -> 最近上下文与折叠历史。

HistoryGroup[] -> serializeHistoryText -> clipboard 或主进程保存对话框 -> UTF-8 TXT。

翻译响应 -> 记录 firstDraftVisibleAtMs -> 更新当前字幕/caption -> 浏览器绘制 -> 延迟历史 writer -> 分组与 localStorage。

固定样本 -> 改造前报告 -> 实现 -> 改造后同条件报告 -> 零回退比较 -> 通过后进入功能验收。

---

## 测试步骤

- npm run build
- npm test
- 补充 UI 偏好解析函数的单元测试。
- 保留 nativeAudioCapability 单元验证；在可用环境分别执行 Windows/macOS/Linux smoke build。
- 新增 npm run test:history，并纳入 npm test。
- 覆盖同一 segment 多次修订仅保留一条、不同会话 ID 不冲突、超过 500 条裁剪最旧记录。
- 覆盖损坏或旧版本 localStorage 安全回退为空数组。
- 覆盖恰好 8 秒继续合并、超过 8 秒分段、来源和语言切换分段。
- 覆盖 6、20、100 个连续记录均保持同一段，不存在句数上限。
- 覆盖 enqueue 阶段不访问 localStorage，flush 阶段合并写入，beforeunload 冲刷。
- npm run test:timing-harness：带空历史和 500 条历史时确定性可见延迟一致。
- npm run verify:latency-reference：比较 fastDraft/endToEnd/activeLag/recovery。
- npm run benchmark:fast-draft-models：同模型、同样本至少 3 轮成对测试。
- npm test 与 npm run build 全部通过。

## 手工验证

- 在 680×420、820×520 和 1280×720 检查文字、按钮、设置弹层与折叠历史无重叠。
- 确认主界面不再出现诊断、重试、队列、延迟、已定稿等技术文案。
- Windows 完整执行系统音频、麦克风、文件场景。
- macOS/Linux 至少执行启动、语言切换、历史持久化、麦克风、文件和系统音频 fallback 检查。
- 开始同传产生历史，暂停、继续、切源、切语言和重启应用后确认已有历史仍在。
- 持续输入超过 5 句且间隔均不超过 8 秒，确认历史仍为一个段落。
- 制造超过 8 秒间隔，确认新内容另起段落。
- 确认界面最新段落在上，复制/导出的阅读顺序为最早到最新。
- 历史关闭和展开两种状态下分别运行同传，确认当前字幕更新节奏一致。
- 500 条历史、连续长段落、亮暗主题下观察 renderer 无明显卡顿。
- 任何改造后指标高于改造前时停止验收，定位历史写入、分组或 DOM 渲染热点。

---

## 改动风险与注意事项

- App.tsx 仍是大型组件，布局替换需要逐段迁移事件绑定，避免误删采集与 provider 行为。
- 暗色主题需要同时检查错误态和悬浮字幕对比度。
- 不同 macOS/Linux 版本、权限和窗口管理器会影响 desktopCapturer 的系统音轨可用性，文档需保持明确。
- 不限制句数可能形成长段落，历史面板通过自动换行、内部滚动和完整导出承载。
- localStorage 存在容量和写入失败风险，通过精简字段、500 条上限、异常回退及可导出降低影响。
- 延迟写入需要在窗口关闭前冲刷，避免最后一帧字幕丢失。
- 英文与中文段落连接规则需要单元测试覆盖标点和空格。
- 真实 provider 和公网延迟具有波动，采用相同环境、交替顺序、至少 3 轮和中位数对比降低噪声。
- 长段落展开会增加 DOM 文本量，历史默认收起并使用列表窗口内滚动，必要时仅渲染最近可见分组。
- beforeunload 同步冲刷只发生在窗口关闭路径，不进入实时字幕路径。
