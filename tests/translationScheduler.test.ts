import assert from "node:assert/strict";
import type { AsrSegment } from "../src/asr/types";
import { createLowLatencyTranslationScheduler } from "../src/translation/scheduler";
import type { TranslationClient, TranslationLanguagePair, TranslationRequest } from "../src/translation/types";

function segment(id: string, text: string, revision: number, status: "partial" | "final"): AsrSegment {
  return {
    id,
    sourceType: "system",
    text,
    status,
    startedAtMs: 0,
    endedAtMs: 500,
    updatedAtMs: 1000 + revision,
    latencyMs: 120,
    revision
  };
}

const languagePair: TranslationLanguagePair = {
  id: "en-zh",
  source: {
    code: "en-US",
    label: "英语",
    translationLocale: "English"
  },
  target: {
    code: "zh-CN",
    label: "中文",
    translationLocale: "Chinese"
  },
  translationModel: "qwen-plus"
};

function translated(request: TranslationRequest): Awaited<ReturnType<TranslationClient["translate"]>> {
  return {
    id: `translation-${request.segment.id}-${request.segment.revision}`,
    segmentId: request.segment.id,
    sourceText: request.segment.text,
    translatedText: `译文 ${request.segment.revision}`,
    languagePairId: request.languagePair.id,
    sourceLanguage: request.languagePair.source.label,
    targetLanguage: request.languagePair.target.label,
    status: request.segment.status === "final" ? "translated" : "partial",
    revision: request.segment.revision,
    revisionReason: request.segment.revision === 1 ? "initial" : "translation-correction",
    createdAtMs: Date.now(),
    latencyMs: 80,
    contextSize: request.context.length,
    provider: "aliyun",
    model: "qwen-plus",
    error: null,
    fallback: false
  };
}

let calls = 0;
const client: TranslationClient = {
  async translate(request: TranslationRequest) {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return translated(request);
  }
};

async function main(): Promise<void> {
  const scheduler = createLowLatencyTranslationScheduler(client, {
    minPartialCharacters: 10,
    minPartialWords: 3,
    partialDebounceMs: 200
  });

  assert.equal(
    scheduler.shouldTranslate(segment("s1", "short", 1, "partial"), 1002),
    false
  );
  assert.equal(
    scheduler.shouldTranslate(segment("s1", "long enough text", 1, "partial"), 1002),
    true
  );

  const first = await scheduler.schedule({
    segment: segment("s1", "long enough text", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 1300
  });

  assert.equal(first?.translatedText, "译文 1");

  const reused = await scheduler.schedule({
    segment: segment("s1", "long enough text", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 1320
  });

  assert.equal(reused?.translatedText, "译文 1");
  assert.equal(calls, 1);
  assert.equal(scheduler.getDiagnostics().reused, 1);
  assert.equal(scheduler.getDiagnostics().skippedIneligible, 0);
  assert.ok(scheduler.getDiagnostics().lastInFlightAgeMs !== null);

  const staleScheduler = createLowLatencyTranslationScheduler(client, {
    minPartialCharacters: 1
  });
  const stalePromise = staleScheduler.schedule({
    segment: segment("s2", "first text", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 1500
  });
  const latestPromise = staleScheduler.schedule({
    segment: segment("s2", "second text", 2, "final"),
    languagePair,
    context: [],
    nowMs: 1510
  });

  const stale = await stalePromise;
  const latest = await latestPromise;
  assert.equal(stale, null);
  assert.equal(latest?.revision, 2);
  assert.equal(staleScheduler.getDiagnostics().droppedStale, 1);

  let releaseIgnored!: () => void;
  const ignoredGate = new Promise<void>((resolve) => {
    releaseIgnored = resolve;
  });
  const ignoredCalls: number[] = [];
  const ignoredCancellationScheduler = createLowLatencyTranslationScheduler(
    {
      async translate(request) {
        ignoredCalls.push(request.segment.revision);
        if (request.segment.revision === 1) {
          await ignoredGate;
        }
        return translated(request);
      }
    },
    { minPartialCharacters: 1 }
  );

  const ignoredFirst = ignoredCancellationScheduler.schedule({
    segment: segment("rapid-1", "first", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 2000
  });
  const replacedPending = ignoredCancellationScheduler.schedule({
    segment: segment("rapid-2", "second", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 2010
  });
  const latestPending = ignoredCancellationScheduler.schedule({
    segment: segment("rapid-3", "third", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 2020
  });

  assert.equal(ignoredCancellationScheduler.getDiagnostics().activeLaneDepth, 2);
  assert.equal(ignoredCancellationScheduler.getDiagnostics().inFlight, 1);
  releaseIgnored();
  assert.equal(await ignoredFirst, null);
  assert.equal(await replacedPending, null);
  assert.equal((await latestPending)?.segmentId, "rapid-3");
  assert.deepEqual(ignoredCalls, [1, 1]);
  assert.equal(ignoredCancellationScheduler.getDiagnostics().supersededPartials, 2);
  assert.equal(ignoredCancellationScheduler.getDiagnostics().cancellationAttempts, 1);
  assert.equal(ignoredCancellationScheduler.getDiagnostics().cancellationIgnored, 1);

  const abortingScheduler = createLowLatencyTranslationScheduler(
    {
      translate(request) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(translated(request)), 30);
          request.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true }
          );
        });
      }
    },
    { minPartialCharacters: 1 }
  );
  const aborted = abortingScheduler.schedule({
    segment: segment("abort-1", "old", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 3000
  });
  const afterAbort = abortingScheduler.schedule({
    segment: segment("abort-2", "new", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 3010
  });
  assert.equal(await aborted, null);
  assert.equal((await afterAbort)?.segmentId, "abort-2");
  assert.equal(abortingScheduler.getDiagnostics().cancellationSucceeded, 1);

  let releaseBackfill!: () => void;
  const backfillGate = new Promise<void>((resolve) => {
    releaseBackfill = resolve;
  });
  const laneCalls: string[] = [];
  const backfillScheduler = createLowLatencyTranslationScheduler(
    {
      async translate(request) {
        laneCalls.push(`${request.lane}:${request.segment.id}`);
        if (request.lane === "backfill") {
          await backfillGate;
        }
        return translated(request);
      }
    },
    { minPartialCharacters: 1, backfillQueueLimit: 2 }
  );
  const backfills = [1, 2, 3, 4].map((index) =>
    backfillScheduler.schedule({
      segment: segment(`backfill-${index}`, `final ${index}`, 1, "final"),
      languagePair,
      context: [],
      nowMs: 4000 + index,
      lane: "backfill"
    })
  );
  const activeDuringBackfill = await backfillScheduler.schedule({
    segment: segment("active-now", "current", 1, "partial"),
    languagePair,
    context: [],
    nowMs: 4100,
    lane: "active"
  });
  assert.equal(activeDuringBackfill?.segmentId, "active-now");
  assert.equal(backfillScheduler.getDiagnostics().backfillDepth, 3);
  assert.equal(backfillScheduler.getDiagnostics().skippedBackfills, 1);
  releaseBackfill();
  await Promise.all(backfills);
  assert.ok(laneCalls.includes("active:active-now"));
  assert.ok(laneCalls.includes("backfill:backfill-1"));

  console.log("translation scheduler checks passed");
}

void main();
