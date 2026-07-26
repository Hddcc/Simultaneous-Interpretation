import assert from "node:assert/strict";
import { groupHistoryRecords, HISTORY_GROUP_GAP_MS } from "../src/history/grouping";
import type { HistoryRecord } from "../src/history/types";

function record(index: number, overrides: Partial<HistoryRecord> = {}): HistoryRecord {
  const startedAtMs = index * 1000;
  return {
    id: `session-a:segment-${index}`,
    sessionId: "session-a",
    segmentId: `segment-${index}`,
    sourceType: "system",
    languagePairId: "en-to-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    sourceText: `word${index}`,
    translatedText: `句子${index}`,
    startedAtMs,
    endedAtMs: startedAtMs + 500,
    updatedAtMs: startedAtMs + 600,
    revised: false,
    ...overrides
  };
}

for (const count of [6, 20, 100]) {
  const groups = groupHistoryRecords(Array.from({ length: count }, (_, index) => record(index)));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].records.length, count);
}

const exactBoundary = groupHistoryRecords([
  record(0, { endedAtMs: 500 }),
  record(1, { startedAtMs: 500 + HISTORY_GROUP_GAP_MS, endedAtMs: 9000 })
]);
assert.equal(exactBoundary.length, 1);

const beyondBoundary = groupHistoryRecords([
  record(0, { endedAtMs: 500 }),
  record(1, { startedAtMs: 501 + HISTORY_GROUP_GAP_MS, endedAtMs: 9001 })
]);
assert.equal(beyondBoundary.length, 2);

assert.equal(groupHistoryRecords([record(0), record(1, { sessionId: "session-b" })]).length, 2);
assert.equal(groupHistoryRecords([record(0), record(1, { sourceType: "microphone" })]).length, 2);
assert.equal(groupHistoryRecords([record(0), record(1, { languagePairId: "zh-to-en" })]).length, 2);

const crossSession = groupHistoryRecords([
  record(0, { sessionId: "older", updatedAtMs: 1000 }),
  record(0, { id: "newer:segment-0", sessionId: "newer", updatedAtMs: 5000 })
]);
assert.equal(crossSession[0].records[0].sessionId, "newer");

const joined = groupHistoryRecords([
  record(0, { sourceText: "Hello", translatedText: "你好" }),
  record(1, { sourceText: "world.", translatedText: "世界。" })
])[0];
assert.equal(joined.sourceText, "Hello world.");
assert.equal(joined.translatedText, "你好世界。");

console.log("history grouping checks passed");
