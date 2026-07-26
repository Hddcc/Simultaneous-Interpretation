import assert from "node:assert/strict";
import {
  DEFAULT_FLOATING_SHRINK_SETTLE_MS,
  initialFloatingHeightRequestState,
  planFloatingHeightRequest
} from "../src/captions/floatingHeight";
import {
  defaultFloatingCaptionPreferences,
  extractFloatingCaptionContent,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
  FLOATING_WIDTH_STEP,
  mergeFloatingCaptionState,
  normalizeFloatingCaptionPreferences,
  resolveFloatingHeight,
  resolveFloatingWidth,
  type FloatingCaptionContent,
  type FloatingWindowRect
} from "../electron/floatingWindowLayout";

const workArea: FloatingWindowRect = { x: 0, y: 0, width: 1920, height: 1000 };

const baseContent: FloatingCaptionContent = {
  translatedText: "当然，同样的原则也适用于其他强大的领域。",
  sourceText: "Of course, the same principle applies in other strong fields.",
  previousText: null,
  statusLabel: "实时字幕",
  compactStatusLabel: "流式",
  severity: "active",
  languageDirection: "英语 -> 中文",
  sessionStatus: "流式运行",
  latencyLabel: "820 ms",
  revised: false,
  running: true,
  controlsVisible: true,
  updatedAtMs: 1_700_000_000_000
};

// A caption parked near the bottom of the screen grows upward, the way a desktop
// lyric overlay does, so the text never marches off the bottom edge.
const grownFromBottom = resolveFloatingHeight({
  contentHeight: 320,
  bounds: { x: 1200, y: 780, width: 620, height: 200 },
  workArea
});
assert.equal(grownFromBottom.height, 320);
assert.equal(grownFromBottom.y, 660);
assert.equal(grownFromBottom.y + grownFromBottom.height, 980);
assert.equal(grownFromBottom.width, 620);

const grownFromTop = resolveFloatingHeight({
  contentHeight: 320,
  bounds: { x: 40, y: 30, width: 620, height: 200 },
  workArea
});
assert.equal(grownFromTop.y, 30, "top-anchored overlays keep their top edge");

const shrunk = resolveFloatingHeight({
  contentHeight: 40,
  bounds: { x: 1200, y: 780, width: 620, height: 200 },
  workArea
});
assert.equal(shrunk.height, FLOATING_MIN_HEIGHT, "tiny captions clamp to the floor");

const capped = resolveFloatingHeight({
  contentHeight: 5000,
  bounds: { x: 1200, y: 100, width: 620, height: 200 },
  workArea
});
assert.equal(capped.height, 600, "height caps at 60% of the work area");
assert.ok(capped.y >= workArea.y);
assert.ok(capped.y + capped.height <= workArea.y + workArea.height);

const nonNumericHeight = resolveFloatingHeight({
  contentHeight: Number.NaN,
  bounds: { x: 1200, y: 100, width: 620, height: 240 },
  workArea
});
assert.equal(nonNumericHeight.height, 240, "a bad measurement leaves the window alone");

// Width steps from the overlay controls keep the edge nearest the screen border
// pinned, so a right-parked overlay does not creep off screen.
const widerOnTheRight = resolveFloatingWidth({
  delta: 1,
  bounds: { x: 1260, y: 700, width: 620, height: 200 },
  workArea
});
assert.equal(widerOnTheRight.width, 620 + FLOATING_WIDTH_STEP);
assert.equal(widerOnTheRight.x, 1180);
assert.equal(widerOnTheRight.x + widerOnTheRight.width, 1880);

const widerOnTheLeft = resolveFloatingWidth({
  delta: 1,
  bounds: { x: 40, y: 700, width: 620, height: 200 },
  workArea
});
assert.equal(widerOnTheLeft.x, 40, "left-parked overlays keep their left edge");

const narrowest = resolveFloatingWidth({
  delta: -8,
  bounds: { x: 1260, y: 700, width: 620, height: 200 },
  workArea
});
assert.equal(narrowest.width, FLOATING_MIN_WIDTH);

const widest = resolveFloatingWidth({
  delta: 40,
  bounds: { x: 40, y: 700, width: 620, height: 200 },
  workArea
});
assert.equal(widest.width, workArea.width - 32);
assert.ok(widest.x >= workArea.x);
assert.ok(widest.x + widest.width <= workArea.x + workArea.width);

// The overlay owns its display preferences. A caption refresh from the main window
// must not reset the font size, backdrop, or lock the user picked in the overlay.
const overlayPreferences = normalizeFloatingCaptionPreferences({
  fontScale: 1.4,
  backdrop: "soft",
  locked: true,
  mousePassthrough: true
});
assert.equal(overlayPreferences.fontScale, 1.4);
assert.equal(overlayPreferences.backdrop, "soft");
assert.equal(overlayPreferences.opacity, defaultFloatingCaptionPreferences.opacity);

const refreshedCaption = mergeFloatingCaptionState(
  extractFloatingCaptionContent({
    ...baseContent,
    ...defaultFloatingCaptionPreferences,
    translatedText: "下一句译文",
    updatedAtMs: 1_700_000_005_000
  }),
  overlayPreferences
);
assert.equal(refreshedCaption.translatedText, "下一句译文");
assert.equal(refreshedCaption.fontScale, 1.4, "font scale survives a caption refresh");
assert.equal(refreshedCaption.backdrop, "soft", "backdrop survives a caption refresh");
assert.equal(refreshedCaption.locked, true, "lock state survives a caption refresh");
assert.equal(refreshedCaption.running, true);

const partialUpdate = normalizeFloatingCaptionPreferences({ backdrop: "solid" }, overlayPreferences);
assert.equal(partialUpdate.backdrop, "solid");
assert.equal(partialUpdate.fontScale, 1.4, "a partial update keeps untouched preferences");

const rejectedValues = normalizeFloatingCaptionPreferences(
  { backdrop: "rainbow", fontScale: Number.NaN } as never,
  overlayPreferences
);
assert.equal(rejectedValues.backdrop, "soft", "unknown backdrops fall back");
assert.equal(rejectedValues.fontScale, 1.4, "non-numeric font scales fall back");
assert.equal(normalizeFloatingCaptionPreferences({ fontScale: 12 }).fontScale, 2.2);
assert.equal(normalizeFloatingCaptionPreferences({ fontScale: 0.1 }).fontScale, 0.7);

// A streaming translation must not make the window step up and down on every token.
// Growth applies at once; shrinking waits for the measurement to hold still.
let heightState = initialFloatingHeightRequestState;
let clockMs = 1_000;

function measure(height: number, advanceMs = 60): ReturnType<typeof planFloatingHeightRequest> {
  clockMs += advanceMs;
  const plan = planFloatingHeightRequest({ measuredHeight: height, state: heightState, nowMs: clockMs });
  heightState = plan.state;
  return plan;
}

assert.equal(measure(280).requestHeight, 280, "the first measurement is applied");
assert.equal(measure(281).requestHeight, null, "sub-threshold noise is ignored");
assert.equal(measure(324).requestHeight, 324, "growth applies immediately");
assert.equal(measure(367).requestHeight, 367, "further growth applies immediately");

// The long cue ends and the next one starts short: the window must not snap back yet.
const firstShrink = measure(280);
assert.equal(firstShrink.requestHeight, null, "shrinking does not apply on the first sighting");
assert.equal(firstShrink.recheckInMs, DEFAULT_FLOATING_SHRINK_SETTLE_MS);
assert.equal(measure(280, 300).requestHeight, null, "still waiting for the cue to settle");

// The new translation streams and regrows, but stays under the window we already have,
// so there is nothing to resize and the shrink target simply retargets.
const retargeted = measure(324, 100);
assert.equal(retargeted.requestHeight, null, "regrowing under the current height resizes nothing");
assert.equal(heightState.appliedHeight, 367, "the window is still the taller one");
assert.equal(heightState.pendingShrinkHeight, 324, "the pending shrink retargets");
assert.equal(retargeted.recheckInMs, DEFAULT_FLOATING_SHRINK_SETTLE_MS, "and its timer restarts");

assert.equal(measure(324, 300).requestHeight, null, "the restarted timer is still running");
assert.equal(
  measure(324, DEFAULT_FLOATING_SHRINK_SETTLE_MS).requestHeight,
  324,
  "the shrink applies once the measurement has held still"
);
assert.equal(heightState.appliedHeight, 324);

assert.equal(measure(500).requestHeight, 500, "a cue taller than the window still grows at once");

const ignoredMeasurement = planFloatingHeightRequest({
  measuredHeight: 0,
  state: heightState,
  nowMs: clockMs
});
assert.equal(ignoredMeasurement.requestHeight, null, "a zero measurement is never applied");
assert.equal(ignoredMeasurement.state.appliedHeight, 500, "and it leaves the window alone");

console.log("floating caption overlay checks passed");
