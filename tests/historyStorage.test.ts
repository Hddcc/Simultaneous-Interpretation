import assert from "node:assert/strict";
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  loadHistory,
  saveHistory,
  serializeHistoryText,
  upsertHistoryRecords,
  type HistoryStorageLike
} from "../src/history/storage";
import type { HistoryGroup, HistoryRecord } from "../src/history/types";

function record(index: number, overrides: Partial<HistoryRecord> = {}): HistoryRecord {
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
    revised: false,
    ...overrides
  };
}

class MemoryStorage implements HistoryStorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const revised = upsertHistoryRecords([record(1)], [record(1, { translatedText: "修订译文", revised: true })]);
assert.equal(revised.length, 1);
assert.equal(revised[0].translatedText, "修订译文");
assert.equal(revised[0].revised, true);

const separateSession = upsertHistoryRecords(
  [record(1)],
  [record(1, { id: "session-b:segment-1", sessionId: "session-b" })]
);
assert.equal(separateSession.length, 2);

const overflow = upsertHistoryRecords([], Array.from({ length: HISTORY_LIMIT + 20 }, (_, index) => record(index)));
assert.equal(overflow.length, HISTORY_LIMIT);
assert.equal(overflow[0].segmentId, `segment-${HISTORY_LIMIT + 19}`);
assert.equal(overflow.at(-1)?.segmentId, "segment-20");

const storage = new MemoryStorage();
saveHistory(storage, [record(1), record(2)]);
assert.deepEqual(loadHistory(storage).map((item) => item.id), [record(2).id, record(1).id]);

storage.values.set(HISTORY_STORAGE_KEY, "{broken");
assert.deepEqual(loadHistory(storage), []);
storage.values.set(HISTORY_STORAGE_KEY, JSON.stringify({ version: 2, records: [record(1)] }));
assert.deepEqual(loadHistory(storage), []);
storage.values.set(HISTORY_STORAGE_KEY, JSON.stringify({ version: 1, records: [{ id: "missing-fields" }] }));
assert.deepEqual(loadHistory(storage), []);

const groups: HistoryGroup[] = [
  { id: "new", startedAtMs: 2000, endedAtMs: 2500, sourceText: "Second", translatedText: "第二段", translationAvailable: true, revised: false, records: [record(2)] },
  { id: "old", startedAtMs: 1000, endedAtMs: 1500, sourceText: "First", translatedText: "第一段", translationAvailable: true, revised: false, records: [record(1)] }
];
const serialized = serializeHistoryText(groups);
assert.ok(serialized.indexOf("First") < serialized.indexOf("Second"));
assert.match(serialized, /第一段[\s\S]*第二段/u);

const recovered = upsertHistoryRecords(
  [record(3, { translatedText: "", translationAvailable: false })],
  [record(3, { translatedText: "恢复译文", translationAvailable: true, revised: true })]
);
assert.equal(recovered.length, 1);
assert.equal(recovered[0].translatedText, "恢复译文");
assert.equal(recovered[0].translationAvailable, true);
const unavailableSerialized = serializeHistoryText([
  {
    id: "unavailable",
    startedAtMs: 3000,
    endedAtMs: 3500,
    sourceText: "Source unavailable",
    translatedText: "",
    translationAvailable: false,
    revised: false,
    records: [record(3, { translatedText: "", translationAvailable: false })]
  }
]);
assert.ok(unavailableSerialized.includes("[译文暂不可用]"));

console.log("history storage checks passed");
