import type { AudioSessionState, AudioSourceType } from "../audio/types";

export type LiveExperiencePhase =
  | "idle"
  | "ready"
  | "capturing"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "degraded"
  | "error"
  | "stopped";

export type LiveExperienceSeverity = "neutral" | "active" | "warning" | "error";

export interface LiveExperienceState {
  phase: LiveExperiencePhase;
  severity: LiveExperienceSeverity;
  label: string;
  compactLabel: string;
  detail: string;
  recoveryAction: string;
  canRetry: boolean;
  canStop: boolean;
  canUseFallback: boolean;
}

interface CreateLiveExperienceStateInput {
  session: AudioSessionState;
  providerHealth: ProviderHealth | null;
  nativeAudioCapability: NativeSystemAudioCapability | null;
}

function getSourceName(sourceType: AudioSourceType): string {
  if (sourceType === "system") {
    return "系统音频";
  }

  if (sourceType === "microphone") {
    return "麦克风";
  }

  return "文件模拟";
}

function getProviderStateLabel(state: ProviderConnectionState | undefined): string {
  if (state === "connecting") {
    return "正在连接实时服务";
  }

  if (state === "streaming") {
    return "实时服务流式运行中";
  }

  if (state === "reconnecting") {
    return "实时服务重连中";
  }

  if (state === "degraded") {
    return "实时服务受限运行";
  }

  if (state === "closing") {
    return "正在关闭实时服务";
  }

  if (state === "closed") {
    return "实时服务已关闭";
  }

  if (state === "missing-config") {
    return "缺少实时服务配置";
  }

  if (state === "error") {
    return "实时服务异常";
  }

  return "本地链路就绪";
}

function hasQueuePressure(providerHealth: ProviderHealth | null, session: AudioSessionState): boolean {
  const queue = providerHealth?.session.queue ?? session.queue;
  return queue.depth >= Math.max(2, Math.floor(queue.maxDepth * 0.75)) || queue.dropped > 0;
}

export function createLiveExperienceState(
  input: CreateLiveExperienceStateInput
): LiveExperienceState {
  const { session, providerHealth, nativeAudioCapability } = input;
  const providerState = providerHealth?.session.state;
  const sourceName = getSourceName(session.sourceType);

  if (session.status === "error" || providerState === "error" || providerState === "missing-config") {
    const detail =
      session.error ||
      providerHealth?.session.error ||
      providerHealth?.config.missing.join(", ") ||
      "当前实时链路需要处理后再继续。";

    return {
      phase: "error",
      severity: "error",
      label: "需要处理",
      compactLabel: "异常",
      detail,
      recoveryAction:
        session.sourceType === "system"
          ? "可重试当前来源，或切换到麦克风/文件模拟继续。"
          : "可重试当前来源，或切换输入来源继续。",
      canRetry: true,
      canStop: true,
      canUseFallback: true
    };
  }

  if (providerState === "reconnecting") {
    return {
      phase: "reconnecting",
      severity: "warning",
      label: "重连中",
      compactLabel: "重连中",
      detail: "实时服务正在恢复连接，最新可用字幕会继续保留。",
      recoveryAction: "可以等待自动恢复，也可以停止后重试。",
      canRetry: true,
      canStop: true,
      canUseFallback: true
    };
  }

  if (providerState === "degraded" || hasQueuePressure(providerHealth, session)) {
    return {
      phase: "degraded",
      severity: "warning",
      label: "受限运行",
      compactLabel: "受限",
      detail: "实时队列压力偏高，字幕可能出现延迟或片段丢弃。",
      recoveryAction: "可以继续观察，或停止后重试以恢复低延迟链路。",
      canRetry: true,
      canStop: true,
      canUseFallback: true
    };
  }

  if (providerState === "connecting") {
    return {
      phase: "connecting",
      severity: "active",
      label: "连接中",
      compactLabel: "连接中",
      detail: "正在建立 provider 会话，音频捕获启动后会进入流式识别。",
      recoveryAction: "开始连接时仍可切换来源；长时间无响应可停止后重试。",
      canRetry: false,
      canStop: true,
      canUseFallback: false
    };
  }

  if (session.status === "streaming") {
    const providerDetail = providerHealth?.config.realtimeEnabled
      ? getProviderStateLabel(providerState)
      : "本地模拟链路运行中";

    return {
      phase: providerState === "streaming" ? "streaming" : "capturing",
      severity: "active",
      label: providerState === "streaming" ? "流式运行" : "捕获中",
      compactLabel: providerState === "streaming" ? "流式" : "捕获",
      detail: `${sourceName}正在输入，${providerDetail}。`,
      recoveryAction: "字幕持续更新中，可随时停止或切换来源。",
      canRetry: false,
      canStop: true,
      canUseFallback: false
    };
  }

  if (session.status === "paused" || session.status === "stopped" || providerState === "closed") {
    return {
      phase: "stopped",
      severity: "neutral",
      label: session.status === "paused" ? "已暂停" : "已停止",
      compactLabel: session.status === "paused" ? "暂停" : "停止",
      detail: `${sourceName}链路已停止，最近字幕仍可查看。`,
      recoveryAction: "点击开始可重新进入实时输入。",
      canRetry: true,
      canStop: false,
      canUseFallback: session.sourceType === "system"
    };
  }

  if (session.status === "ready") {
    return {
      phase: "ready",
      severity: "neutral",
      label: "就绪",
      compactLabel: "就绪",
      detail: `${sourceName}已就绪，可以开始同传。`,
      recoveryAction: "点击开始进入实时输入。",
      canRetry: false,
      canStop: false,
      canUseFallback: false
    };
  }

  if (
    session.sourceType === "system" &&
    nativeAudioCapability &&
    nativeAudioCapability.status !== "available"
  ) {
    return {
      phase: "degraded",
      severity: "warning",
      label: "捕获受限",
      compactLabel: "受限",
      detail: nativeAudioCapability.notes[0] ?? "系统音频捕获路径暂不可用。",
      recoveryAction: "可以刷新来源，或切换麦克风/文件模拟继续验证。",
      canRetry: true,
      canStop: false,
      canUseFallback: true
    };
  }

  return {
    phase: "idle",
    severity: "neutral",
    label: "等待输入",
    compactLabel: "等待",
    detail: `${sourceName}尚未开始输入。`,
    recoveryAction: "选择来源和语言方向后点击开始。",
    canRetry: false,
    canStop: false,
    canUseFallback: false
  };
}
