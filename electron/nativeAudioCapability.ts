import { access, constants } from "node:fs/promises";
import path from "node:path";

export type NativeAudioCapabilityStatus = "available" | "unsupported-platform" | "helper-missing";

export interface NativeSystemAudioCapability {
  platform: NodeJS.Platform;
  strategy: "windows-wasapi-loopback-helper";
  helperName: string;
  helperPath: string;
  available: boolean;
  status: NativeAudioCapabilityStatus;
  sampleRate: number;
  channels: number;
  chunkDurationMs: number;
  fallback: "electron-desktop-capture";
  checkedAtMs: number;
  notes: string[];
  nextStep: string;
}

const HELPER_RELATIVE_PATH = path.join("native-audio-helper", "wasapi-loopback-helper.exe");

async function canExecuteFile(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function detectNativeSystemAudioCapability(
  appRoot = process.cwd()
): Promise<NativeSystemAudioCapability> {
  const helperPath = path.join(appRoot, HELPER_RELATIVE_PATH);
  const isWindows = process.platform === "win32";
  const helperAvailable = isWindows ? await canExecuteFile(helperPath) : false;

  if (!isWindows) {
    return {
      platform: process.platform,
      strategy: "windows-wasapi-loopback-helper",
      helperName: "wasapi-loopback-helper.exe",
      helperPath,
      available: false,
      status: "unsupported-platform",
      sampleRate: 16000,
      channels: 1,
      chunkDurationMs: 200,
      fallback: "electron-desktop-capture",
      checkedAtMs: Date.now(),
      notes: [
        "当前完整系统播放声捕获方案优先支持 Windows WASAPI loopback。",
        "非 Windows 平台继续使用 Electron desktopCapturer、麦克风或文件模拟兜底。"
      ],
      nextStep: "后续 PR 将补充 Windows helper 的真实 PCM 输出和 provider payload contract。"
    };
  }

  return {
    platform: process.platform,
    strategy: "windows-wasapi-loopback-helper",
    helperName: "wasapi-loopback-helper.exe",
    helperPath,
    available: helperAvailable,
    status: helperAvailable ? "available" : "helper-missing",
    sampleRate: 16000,
    channels: 1,
    chunkDurationMs: 200,
    fallback: "electron-desktop-capture",
    checkedAtMs: Date.now(),
    notes: helperAvailable
      ? [
          "已检测到 Windows WASAPI loopback helper 占位入口。",
          "本 PR 只暴露能力检测，后续 PR 接入真实音频帧输出。"
        ]
      : [
          "尚未安装 Windows WASAPI loopback helper。",
          "系统音频当前仍走 Electron desktopCapturer fallback，可能无法覆盖腾讯会议或微信通话等场景。"
        ],
    nextStep: helperAvailable
      ? "实现 helper 进程启动、PCM 帧读取和停止清理。"
      : "新增 native-audio-helper/wasapi-loopback-helper.exe 或等价 helper，并接入启动检测。"
  };
}
