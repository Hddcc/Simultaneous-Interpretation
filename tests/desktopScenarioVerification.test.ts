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
  "microphone-fallback",
  "floating-caption-overlay",
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

const ttsScenario = getDesktopScenarioVerification("optional-tts-output");
assert.equal(ttsScenario.status, "fallback-acceptable");

console.log("desktop scenario verification checks passed");
