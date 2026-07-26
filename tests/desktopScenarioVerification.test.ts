import assert from "node:assert/strict";
import {
  desktopScenarioVerifications,
  getDesktopScenarioVerification,
  type DesktopScenarioId
} from "../src/verification/desktopScenarios";

const requiredScenarioIds: DesktopScenarioId[] = [
  "browser-system-audio",
  "meeting-system-audio",
  "call-system-audio",
  "lyric-low-latency-revision",
  "bilibili-realtime-catch-up",
  "microphone-fallback",
  "floating-caption-overlay",
  "floating-lyric-lock",
  "optional-tts-output"
];

assert.deepEqual(
  desktopScenarioVerifications.map((scenario) => scenario.id).sort(),
  [...requiredScenarioIds].sort()
);

desktopScenarioVerifications.forEach((scenario) => {
  assert.ok(scenario.title.length > 0, `${scenario.id} needs a title`);
  assert.ok(scenario.setup.length >= 3, `${scenario.id} needs setup steps`);
  assert.ok(scenario.steps.length >= 3, `${scenario.id} needs verification steps`);
  assert.ok(scenario.expectedSignals.length >= 3, `${scenario.id} needs expected signals`);
  assert.ok(scenario.lyricChecks.length >= 3, `${scenario.id} needs lyric checks`);
  assert.ok(scenario.floatingChecks.length >= 3, `${scenario.id} needs floating checks`);
  assert.ok(scenario.fallbackPath.length > 0, `${scenario.id} needs a fallback path`);
  assert.ok(scenario.evidence.length >= 3, `${scenario.id} needs evidence notes`);
});

const browserScenario = getDesktopScenarioVerification("browser-system-audio");
assert.equal(browserScenario.primarySource, "system");
assert.ok(
  browserScenario.expectedSignals.some((signal) => signal.includes("不需要上传音视频文件"))
);

const meetingScenario = getDesktopScenarioVerification("meeting-system-audio");
assert.ok(meetingScenario.fallbackPath.includes("麦克风"));

const callScenario = getDesktopScenarioVerification("call-system-audio");
assert.ok(callScenario.expectedSignals.some((signal) => signal.includes("fallback")));

const floatingScenario = getDesktopScenarioVerification("floating-caption-overlay");
assert.ok(floatingScenario.expectedSignals.some((signal) => signal.includes("悬浮字幕")));
assert.ok(floatingScenario.lyricChecks.some((check) => check.includes("原地更新")));
assert.ok(floatingScenario.floatingChecks.some((check) => check.includes("拖动")));

const floatingLockScenario = getDesktopScenarioVerification("floating-lyric-lock");
assert.equal(floatingLockScenario.primarySource, "system");
assert.ok(floatingLockScenario.expectedSignals.some((signal) => signal.includes("鼠标事件")));
assert.ok(floatingLockScenario.floatingChecks.some((check) => check.includes("滚动条")));

const lyricScenario = getDesktopScenarioVerification("lyric-low-latency-revision");
assert.equal(lyricScenario.primarySource, "file");
assert.ok(lyricScenario.expectedSignals.some((signal) => signal.includes("active cue")));
assert.ok(lyricScenario.lyricChecks.some((check) => check.includes("previous cue")));
assert.ok(lyricScenario.steps.some((step) => step.includes("零条增长到三条")));
assert.ok(lyricScenario.expectedSignals.some((signal) => signal.includes("一个 CSS 像素")));
assert.ok(lyricScenario.expectedSignals.some((signal) => signal.includes("可见滚动条")));
assert.ok(lyricScenario.lyricChecks.some((check) => check.includes("共享阅读锚点")));
assert.ok(lyricScenario.lyricChecks.some((check) => check.includes("完整文本")));
assert.ok(lyricScenario.evidence.some((note) => note.includes("getBoundingClientRect")));

const catchUpScenario = getDesktopScenarioVerification("bilibili-realtime-catch-up");
assert.equal(catchUpScenario.primarySource, "system");
assert.ok(catchUpScenario.setup.some((step) => step.includes("B站")));
assert.ok(catchUpScenario.expectedSignals.some((signal) => signal.includes("active lag")));
assert.ok(catchUpScenario.expectedSignals.some((signal) => signal.includes("保持原样")));
assert.ok(catchUpScenario.lyricChecks.some((check) => check.includes("不触发回退")));

const ttsScenario = getDesktopScenarioVerification("optional-tts-output");
assert.equal(ttsScenario.status, "fallback-acceptable");

console.log("desktop scenario verification checks passed");
