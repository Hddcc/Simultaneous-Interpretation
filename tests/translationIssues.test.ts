import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyTranslationEventToIssues,
  createTranslationIssueKey,
  getLatestTranslationIssue,
  getTranslatedCaptionText,
  type TranslationIssues
} from "../src/translation/issues";
import type { TranslationEvent } from "../src/translation/types";

function event(overrides: Partial<TranslationEvent> = {}): TranslationEvent {
  return {
    id: "translation-segment-1-1",
    segmentId: "segment-1",
    sourceText: "The meeting starts now.",
    translatedText: "",
    languagePairId: "en-zh",
    sourceLanguage: "英语",
    targetLanguage: "中文",
    status: "translated",
    revision: 1,
    revisionReason: "translation-correction",
    createdAtMs: 1000,
    latencyMs: 200,
    contextSize: 0,
    provider: "aliyun",
    model: "qwen-turbo",
    error: "provider unavailable",
    fallback: true,
    failure: {
      category: "provider",
      message: "provider unavailable",
      httpStatus: 503,
      providerCode: "ServiceUnavailable"
    },
    recoveryScheduled: true,
    ...overrides
  };
}

let issues: TranslationIssues = applyTranslationEventToIssues({}, event());
const firstKey = createTranslationIssueKey("segment-1", 1);
assert.equal(issues[firstKey].httpStatus, 503);
assert.equal(issues[firstKey].recoveryPending, true);
assert.equal(
  getTranslatedCaptionText("", getLatestTranslationIssue(issues, "segment-1"), "正在生成译文"),
  "翻译暂不可用，正在重试"
);
assert.equal(
  getTranslatedCaptionText("已有有效译文", getLatestTranslationIssue(issues, "segment-1"), "正在生成译文"),
  "已有有效译文"
);

issues = applyTranslationEventToIssues(issues, event({
  id: "translation-segment-1-1-recovery",
  createdAtMs: 1200,
  attempt: "final-recovery",
  recoveryScheduled: false
}));
assert.equal(issues[firstKey].firstFailedAtMs, 1000);
assert.equal(issues[firstKey].lastFailedAtMs, 1200);
assert.equal(issues[firstKey].recoveryAttempted, true);
assert.equal(issues[firstKey].recoveryPending, false);

issues = applyTranslationEventToIssues(issues, event({ revision: 2, createdAtMs: 1300 }));
assert.equal(getLatestTranslationIssue(issues, "segment-1")?.revision, 2);
issues = applyTranslationEventToIssues(issues, event({
  revision: 2,
  createdAtMs: 1400,
  translatedText: "会议现在开始。",
  error: null,
  fallback: false,
  failure: null
}));
assert.equal(getLatestTranslationIssue(issues, "segment-1"), null);

const unchanged = applyTranslationEventToIssues({}, event({
  error: "aborted",
  failure: { category: "cancelled", message: "aborted", httpStatus: null, providerCode: null }
}));
assert.deepEqual(unchanged, {});

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const recordChunkBody = appSource.slice(
  appSource.indexOf("function recordChunk"),
  appSource.indexOf("function publishAsrEvents")
);
const resetBody = appSource.slice(
  appSource.indexOf("function resetAsrState"),
  appSource.indexOf("function updateLanguagePair")
);
assert.equal(recordChunkBody.includes("setTranslationIssues"), false);
assert.equal(resetBody.includes("setTranslationIssues({})"), true);

console.log("translation issue lifecycle checks passed");
