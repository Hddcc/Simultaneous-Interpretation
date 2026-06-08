export type DesktopScenarioId =
  | "browser-system-audio"
  | "meeting-system-audio"
  | "call-system-audio"
  | "microphone-fallback"
  | "floating-caption-overlay"
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
      "字幕生成过程不需要上传音视频文件。"
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
      "如果捕获受限，恢复界面保留停止、重试和切换备用输入操作。"
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
    fallbackPath: "通话软件音频无法被系统路径捕获时，切换麦克风输入收外放声音。",
    evidence: [
      "记录通话软件名称、音频设备和测试语种。",
      "记录系统音频是否成功、fallback 是否成功。",
      "截图恢复提示或 fallback 后的字幕状态。"
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
      "降级、重连或异常时显示紧凑状态。",
      "字幕文本不和状态信息重叠。"
    ],
    fallbackPath: "如果当前窗口管理器阻止置顶，回到主工作台查看字幕历史并记录平台限制。",
    evidence: [
      "截图悬浮字幕覆盖目标应用窗口。",
      "记录悬浮字幕尺寸、位置和状态标签。",
      "记录切换焦点后字幕是否继续可读。"
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
