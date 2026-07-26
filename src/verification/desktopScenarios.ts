export type DesktopScenarioId =
  | "browser-system-audio"
  | "meeting-system-audio"
  | "call-system-audio"
  | "lyric-low-latency-revision"
  | "bilibili-realtime-catch-up"
  | "microphone-fallback"
  | "floating-caption-overlay"
  | "floating-lyric-lock"
  | "optional-tts-output";

export type DesktopScenarioStatus =
  | "ready-for-manual-verification"
  | "requires-desktop-environment"
  | "fallback-acceptable";

export interface DesktopScenarioVerification {
  id: DesktopScenarioId;
  title: string;
  status: DesktopScenarioStatus;
  primarySource: "system" | "microphone" | "file";
  setup: string[];
  steps: string[];
  expectedSignals: string[];
  lyricChecks: string[];
  floatingChecks: string[];
  fallbackPath: string;
  evidence: string[];
}

export const desktopScenarioVerifications: DesktopScenarioVerification[] = [
  {
    id: "browser-system-audio",
    title: "浏览器视频系统音频同传",
    status: "ready-for-manual-verification",
    primarySource: "system",
    setup: [
      "在浏览器中打开一段包含清晰英语或中文演讲的视频。",
      "在应用中选择系统音频来源，并启用 provider 实时模式。",
      "确认工作台显示系统音频捕获状态、provider 状态和队列状态。"
    ],
    steps: [
      "播放浏览器视频。",
      "点击开始，让应用捕获电脑正在播放的声音。",
      "观察主字幕区是否出现原文和译文字幕。"
    ],
    expectedSignals: [
      "音量条随浏览器视频声音变化。",
      "音频块数量持续增加，Payload 显示 provider-ready。",
      "ASR、翻译延迟和字幕总延迟持续更新。",
      "字幕生成过程不需要上传音视频文件。",
      "主字幕区围绕当前句更新，不在主区域累加成长段落。"
    ],
    lyricChecks: [
      "当前句译文作为最大字号内容显示。",
      "上一句只作为弱化上下文或进入历史。",
      "stable partial 可先显示草稿译文，final 后原地修订。"
    ],
    floatingChecks: [
      "悬浮字幕显示源文和译文。",
      "悬浮字幕不出现滚动条。",
      "悬浮字幕可通过设置入口打开。"
    ],
    fallbackPath: "如果当前系统音频源不能提供音频轨道，切换麦克风外放收音或使用文件模拟验证同传链路。",
    evidence: [
      "记录浏览器名称、视频语言和视频时长。",
      "记录是否出现双语字幕、是否需要 fallback、最终使用的音频源。",
      "截图主工作台状态栏和一条字幕历史记录。"
    ]
  },
  {
    id: "meeting-system-audio",
    title: "会议软件系统音频同传",
    status: "requires-desktop-environment",
    primarySource: "system",
    setup: [
      "打开 Tencent Meeting 或同类桌面会议软件。",
      "加入测试会议或播放会议录制，确保会议软件正在输出语音。",
      "应用选择系统音频来源，并打开悬浮字幕窗口。"
    ],
    steps: [
      "开始系统音频同传。",
      "让会议软件持续播放 30 秒以上语音。",
      "切换焦点到会议窗口，观察悬浮字幕是否保持可读。"
    ],
    expectedSignals: [
      "工作台保持流式运行或给出明确捕获限制。",
      "如果捕获成功，字幕历史出现会议语音的原文和译文。",
      "如果捕获受限，恢复界面保留停止、重试和切换备用输入操作。",
      "悬浮字幕跟随当前句原地更新，不显示 provider 调试信息。"
    ],
    lyricChecks: [
      "主窗口当前句和悬浮字幕当前句一致。",
      "修订发生时当前句内容原地替换。",
      "诊断信息仅在诊断视图中展开。"
    ],
    floatingChecks: [
      "悬浮字幕保持置顶。",
      "锁定后不遮挡会议窗口操作。",
      "主客户端可解锁或关闭悬浮字幕。"
    ],
    fallbackPath: "会议软件阻止系统捕获时，使用麦克风收外放会议声音，并记录为平台限制和 fallback 成功。",
    evidence: [
      "记录会议软件名称、版本和音频输出设备。",
      "记录系统音频捕获结果或平台限制提示。",
      "截图悬浮字幕覆盖会议窗口的状态。"
    ]
  },
  {
    id: "call-system-audio",
    title: "通话软件系统音频同传",
    status: "requires-desktop-environment",
    primarySource: "system",
    setup: [
      "打开 WeChat 或同类通话软件。",
      "准备一段通话音频或实际测试通话。",
      "应用选择系统音频来源，并准备麦克风 fallback。"
    ],
    steps: [
      "开始系统音频同传。",
      "让通话软件输出清晰人声。",
      "观察主工作台和悬浮字幕的字幕更新情况。"
    ],
    expectedSignals: [
      "捕获成功时，字幕来源来自系统音频，不要求上传文件。",
      "捕获受限时，工作台展示可恢复错误和 fallback 操作。",
      "切换麦克风 fallback 后，音量、ASR 和翻译事件继续更新。"
    ],
    lyricChecks: [
      "当前句字幕在通话语音变化时切换。",
      "上一句不会抢占主字幕视线。",
      "fallback 后歌词式字幕仍按同一模式显示。"
    ],
    floatingChecks: [
      "悬浮字幕可覆盖通话窗口。",
      "悬浮字幕显示紧凑状态。",
      "长句不会触发可见滚动条。"
    ],
    fallbackPath: "通话软件音频无法被系统路径捕获时，切换麦克风输入收外放声音。",
    evidence: [
      "记录通话软件名称、音频设备和测试语种。",
      "记录系统音频是否成功、fallback 是否成功。",
      "截图恢复提示或 fallback 后的字幕状态。"
    ]
  },
  {
    id: "lyric-low-latency-revision",
    title: "歌词式低延迟字幕与修订",
    status: "ready-for-manual-verification",
    primarySource: "file",
    setup: [
      "准备一段包含短句、长句和自然停顿的中英测试音频。",
      "配置真实 provider 或 mock provider，确保 ASR partial/final 事件可产生。",
      "在应用中打开历史、诊断和悬浮字幕，便于对照当前句、历史和队列状态。",
      "准备小、中、大三档字号以及标准、窄窗口和低高度窗口尺寸。"
    ],
    steps: [
      "选择文件模拟或系统音频并开始同传。",
      "观察同一 cue 从单行 stable partial 增长到多行草稿译文。",
      "等待 final 和 refinement 返回，确认同一句字幕在固定槽位内原地更新。",
      "让最近上下文从零条增长到三条，确认活动原文和译文锚点保持不变。",
      "切换字号和窗口尺寸，复测超长字幕边界与无滚动条表现。",
      "切换到历史视图，确认被截断的完整长句仍保留在历史中。"
    ],
    expectedSignals: [
      "主字幕区只突出一个 active cue。",
      "翻译队列去重，重复 partial 不会制造重复字幕。",
      "过期翻译结果不会覆盖更新版本。",
      "诊断视图可看到翻译队列、缓存复用、过期丢弃和最近修订。",
      "视口和字号不变时，原文末行与译文首行锚点偏移不超过一个 CSS 像素。",
      "主字幕使用有界行数且不出现可见滚动条、重叠或水平溢出。"
    ],
    lyricChecks: [
      "active cue 包含 sourceText、translatedText、state、revision 和 latency。",
      "previous cue 弱化显示或进入历史。",
      "悬浮字幕与主字幕显示同一个 active cue。",
      "单行到多行、partial 到 final 以及 refinement 替换期间共享阅读锚点保持稳定。",
      "最近上下文在零到三条之间变化时不挤压活动字幕槽位。",
      "超长原文和译文限制在固定槽位内，完整文本继续进入字幕历史。"
    ],
    floatingChecks: [
      "悬浮字幕当前句随 active cue 原地更新。",
      "修订状态不新增重复行。",
      "双语文本在固定窗口内显示。"
    ],
    fallbackPath: "真实 provider 延迟过高时，使用 mock 或固定文件样本复测状态机、修订和 UI 行为。",
    evidence: [
      "记录 stable partial 到首个译文可见的大致延迟。",
      "截图修订前后同一句字幕的变化。",
      "截图诊断视图中的翻译队列和过期丢弃指标。",
      "记录连续修订前后的原文末行和译文首行 getBoundingClientRect 纵坐标。",
      "截图三档字号、代表性窗口尺寸和超长字幕历史全文。"
    ]
  },
  {
    id: "bilibili-realtime-catch-up",
    title: "Edge/B站英语视频追帧与历史补全",
    status: "requires-desktop-environment",
    primarySource: "system",
    setup: [
      "在 Edge 打开一段连续英语讲话的 B站视频并选择系统音频。",
      "配置真实 ASR/翻译 provider，预热会话并清空上一次内部诊断快照。",
      "保持现有客户端控件和字幕布局，准备读取内部 latency/reference report。"
    ],
    steps: [
      "正常语速播放至预热结束，再连续采集至少 50 个合格首稿样本。",
      "切换到快速讲话片段，观察旧 partial 淘汰、late final 和历史补全。",
      "人为制造短暂网络或翻译积压，随后恢复并测量 catch-up 恢复时间。",
      "等待一个旧翻译和一个润色结果晚到，确认 active cue 保持当前句。"
    ],
    expectedSignals: [
      "内部报告包含 fast-draft mean/P50/P95/max、end-to-end P50/P95 和缺失时间戳。",
      "active lag 不超过一个 cue，迟到 final/译文只更新历史。",
      "压力期间 refinement 暂停或跳过，压力解除后 2 秒内恢复。",
      "客户端可见标签、按钮、面板、徽标和设置项保持原样。"
    ],
    lyricChecks: [
      "主字幕持续跟随最新可翻译 cue，旧结果不触发回退。",
      "流式首稿与完整响应在同一个 cue 原地更新。",
      "历史补全保持原始 first-draft/end-to-end 样本不变。"
    ],
    floatingChecks: [
      "悬浮字幕与主字幕 active cue 一致。",
      "快速语速和晚到结果期间不出现旧句回退。",
      "本次优化没有新增悬浮窗口按钮或状态标签。"
    ],
    fallbackPath: "系统音频不可用时使用同一固定英语文件验证调度；该结果作为桌面补充证据，不能替代真实 provider 的 50 样本报告。",
    evidence: [
      "记录 Edge/B站视频、provider/model、网络环境、预热数和请求数。",
      "保存内部 reference report 与 scheduler/refinement diagnostics。",
      "记录晚到翻译、历史补全、无回退和界面控件未变化的截图或录屏。"
    ]
  },
  {
    id: "microphone-fallback",
    title: "麦克风备用输入",
    status: "fallback-acceptable",
    primarySource: "microphone",
    setup: [
      "准备可被麦克风收到的人声输入。",
      "在应用中选择麦克风来源。",
      "确认浏览器授权或 Electron 权限允许麦克风采集。"
    ],
    steps: [
      "点击开始。",
      "播放或朗读英文/中文语音。",
      "观察字幕和翻译是否持续更新。"
    ],
    expectedSignals: [
      "音量条随外部声音变化。",
      "音频块数量持续增加。",
      "字幕历史出现双语片段。",
      "provider 不可用时仍能通过 mock 或错误提示保留源文。"
    ],
    lyricChecks: [
      "麦克风输入也使用歌词式当前句。",
      "final 后当前句进入历史。",
      "错误状态不会清空最近可读字幕。"
    ],
    floatingChecks: [
      "麦克风模式可打开悬浮字幕。",
      "外放收音时悬浮字幕继续显示双语。",
      "异常时保留最近可读字幕。"
    ],
    fallbackPath: "麦克风权限不可用时，改用文件模拟验证同传链路。",
    evidence: [
      "记录麦克风设备名称。",
      "记录字幕是否出现、是否有翻译错误提示。",
      "截图麦克风模式下的音量和字幕历史。"
    ]
  },
  {
    id: "floating-caption-overlay",
    title: "悬浮字幕覆盖其他应用",
    status: "ready-for-manual-verification",
    primarySource: "system",
    setup: [
      "开启任意实时输入来源。",
      "点击打开悬浮字幕。",
      "选择适合桌面的悬浮字幕尺寸和位置。"
    ],
    steps: [
      "切换焦点到浏览器、会议软件或播放器。",
      "保持实时输入继续运行。",
      "观察悬浮字幕是否仍在其他应用之上。"
    ],
    expectedSignals: [
      "悬浮字幕保留最新译文和源文。",
      "悬浮字幕可显示上一句弱化上下文。",
      "受限、重连或异常时显示紧凑状态。",
      "字幕文本不和状态信息重叠。",
      "悬浮字幕没有背景板，可透看到下方桌面内容。",
      "只在悬浮字幕上点开始或暂停即可控制翻译。"
    ],
    lyricChecks: [
      "悬浮窗不追加多行历史。",
      "active cue 修订时悬浮窗原地更新。",
      "英语转中文和中文转英文都保持译文优先。",
      "长句译文完整换行显示，不在首行被截断。",
      "上一句以淡显层级留在当前句上方。"
    ],
    floatingChecks: [
      "悬浮字幕窗口可自由拖动。",
      "悬浮字幕不出现可见滚动条。",
      "hover 时显示轻量控制，离开后隐藏。",
      "译文流式增长时窗口高度保持不变，不出现上下跳动。",
      "超出预留行数的长句结束后，窗口高度稳定片刻才收回。",
      "调整字号后，新字幕到达时字号不被重置。"
    ],
    fallbackPath: "如果当前窗口管理器阻止置顶或不支持透明窗口，切换到深背景档继续验证并记录平台限制。",
    evidence: [
      "截图悬浮字幕覆盖目标应用窗口。",
      "记录悬浮字幕尺寸、位置和状态标签。",
      "记录切换焦点后字幕是否继续可读。",
      "录制悬浮字幕内开始或暂停后主客户端状态同步的过程。"
    ]
  },
  {
    id: "floating-lyric-lock",
    title: "悬浮歌词锁定与鼠标穿透",
    status: "ready-for-manual-verification",
    primarySource: "system",
    setup: [
      "开启任意实时输入来源并打开悬浮字幕。",
      "把悬浮字幕拖到浏览器、会议或播放器窗口上方。",
      "准备主客户端设置入口，便于解锁或重置悬浮字幕。"
    ],
    steps: [
      "拖动悬浮字幕到目标位置。",
      "悬停悬浮字幕，点击锁图标开启鼠标穿透。",
      "在悬浮字幕下方操作浏览器或会议窗口。",
      "把鼠标移回悬浮字幕，点击浮出的解锁图标。",
      "回到主客户端执行解锁或重置位置。"
    ],
    expectedSignals: [
      "悬浮字幕可自由拖动并保持双语显示。",
      "锁定后 hover 控制隐藏或弱化。",
      "鼠标事件可传递给下方应用。",
      "锁定状态下鼠标移入仍能浮出解锁图标。",
      "主客户端可恢复解锁和重置位置。"
    ],
    lyricChecks: [
      "译文仍然是最突出的歌词行。",
      "源文和上一句上下文保持弱化层级。",
      "修订时当前句原地更新。"
    ],
    floatingChecks: [
      "锁定状态传递到 Electron 主进程。",
      "鼠标穿透状态可关闭。",
      "自适应高度窗口内没有滚动条。",
      "解锁图标点击后穿透立即结束。"
    ],
    fallbackPath: "如果当前平台不支持鼠标穿透，保留锁定视觉状态，并通过主客户端关闭或重置悬浮字幕。",
    evidence: [
      "截图锁定前后悬浮字幕状态。",
      "记录下方应用是否可点击。",
      "记录主客户端解锁和重置是否可用。"
    ]
  },
  {
    id: "optional-tts-output",
    title: "可选译文语音播报",
    status: "fallback-acceptable",
    primarySource: "microphone",
    setup: [
      "确认系统支持 Web Speech speechSynthesis。",
      "开启任意可生成 final 字幕的输入来源。",
      "打开译文播报开关。"
    ],
    steps: [
      "生成一条 final 翻译字幕。",
      "观察语音播报队列状态。",
      "测试暂停播报和停止播报。"
    ],
    expectedSignals: [
      "final 字幕后加入播报队列。",
      "播报状态在排队中、播报中、待播报之间切换。",
      "暂停和停止按钮可用，错误时显示恢复提示。"
    ],
    lyricChecks: [
      "播报不改变当前歌词字幕状态。",
      "字幕修订后历史记录保留最新译文。",
      "TTS 控制位于设置视图，不抢占当前字幕区域。"
    ],
    floatingChecks: [
      "播报时悬浮字幕仍可拖动。",
      "播报状态不覆盖歌词正文。",
      "悬浮字幕保持无滚动条。"
    ],
    fallbackPath: "运行环境不支持 Web Speech 时，保留字幕输出并记录语音播报不可用。",
    evidence: [
      "记录系统是否支持 speechSynthesis。",
      "记录播报队列状态和是否成功播放。",
      "截图 TTS 控制区。"
    ]
  }
];

export function getDesktopScenarioVerification(
  id: DesktopScenarioId
): DesktopScenarioVerification {
  const scenario = desktopScenarioVerifications.find((item) => item.id === id);

  if (!scenario) {
    throw new Error(`Unknown desktop scenario: ${id}`);
  }

  return scenario;
}
