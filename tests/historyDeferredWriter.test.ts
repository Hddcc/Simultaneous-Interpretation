import assert from "node:assert/strict";
import { createDeferredHistoryWriter } from "../src/history/deferredWriter";
import type { HistoryRecord } from "../src/history/types";

function record(index: number): HistoryRecord {
  return {
    id: `session-a:segment-${index}`,
    sessionId: "session-a",
    segmentId: `segment-${index}`,
    sourceType: "system",
    languagePairId: "en-to-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    sourceText: `Source ${index}`,
    translatedText: `译文${index}`,
    startedAtMs: index * 1000,
    endedAtMs: index * 1000 + 500,
    updatedAtMs: index * 1000 + 600,
    revised: false
  };
}

let frameCallback: FrameRequestCallback | null = null;
let timerCallback: (() => void) | null = null;
const commits: HistoryRecord[][] = [];
const writer = createDeferredHistoryWriter({
  commit: (records) => commits.push(records),
  requestFrame: (callback) => { frameCallback = callback; return 1; },
  cancelFrame: () => { frameCallback = null; },
  setTimer: (callback) => { timerCallback = callback; return 2; },
  clearTimer: () => { timerCallback = null; }
});

writer.enqueue([record(1)]);
writer.enqueue([record(1), record(2)]);
assert.equal(commits.length, 0);
assert.ok(frameCallback);
(frameCallback as FrameRequestCallback)(0);
assert.equal(commits.length, 0);
assert.ok(timerCallback);
(timerCallback as () => void)();
assert.equal(commits.length, 1);
assert.deepEqual(commits[0].map((item) => item.id), [record(1).id, record(2).id]);

writer.enqueue([record(3)]);
writer.flush();
assert.equal(commits.length, 2);
assert.equal(commits[1][0].id, record(3).id);

writer.enqueue([record(4)]);
writer.dispose();
assert.equal(commits.length, 3);
assert.equal(commits[2][0].id, record(4).id);

console.log("deferred history writer checks passed");
