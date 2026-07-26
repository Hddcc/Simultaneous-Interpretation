import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTranslationMessages } from "../electron/translationPrompt";
import type { AsrSegment } from "../src/asr/types";
import { emptyCaptionCueSnapshot, updateCaptionCueSnapshot } from "../src/captions/cue";
import { toHistoryRecords } from "../src/history/projection";
import { upsertHistoryRecords } from "../src/history/storage";
import { reconcileSubtitleSegments } from "../src/subtitles/reconciliation";
import { createTranslationClient } from "../src/translation/client";
import {
  applyTranslationEventToIssues,
  getLatestTranslationIssue,
  getTranslatedCaptionText
} from "../src/translation/issues";
import { createLowLatencyTranslationScheduler } from "../src/translation/scheduler";
import type {
  TranslationEvent,
  TranslationLanguagePair,
  TranslationRequest
} from "../src/translation/types";
import { validateTranslationText } from "../src/translation/validation";

async function loadLocalEnv(path: string): Promise<void> {
  const contents = await readFile(path, "utf8");
  contents.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  });
}

const languagePair: TranslationLanguagePair = {
  id: "en-US_to_zh-CN",
  source: { code: "en-US", label: "英语", translationLocale: "English" },
  target: { code: "zh-CN", label: "中文", translationLocale: "Simplified Chinese" },
  translationModel: "qwen-plus"
};
const sourceText = "The realtime interpretation pipeline is ready for the meeting.";
const segment: AsrSegment = {
  id: "smoke-final",
  sourceType: "system",
  text: sourceText,
  status: "final",
  startedAtMs: 1000,
  endedAtMs: 1800,
  updatedAtMs: 1900,
  latencyMs: 100,
  revision: 1
};

function providerHealth(model: string): ProviderHealth {
  return {
    config: {
      translationProvider: "aliyun",
      translationModel: model,
      fastDraftModel: model,
      fastDraftStreaming: false
    }
  } as ProviderHealth;
}

function failureEvent(request: TranslationRequest): TranslationEvent {
  return {
    id: `translation-${request.segment.id}-${request.segment.revision}-${request.attempt ?? "initial"}`,
    segmentId: request.segment.id,
    sourceText: request.segment.text,
    translatedText: "",
    languagePairId: request.languagePair.id,
    sourceLanguage: request.languagePair.source.label,
    targetLanguage: request.languagePair.target.label,
    status: "translated",
    revision: request.segment.revision,
    revisionReason: "translation-correction",
    createdAtMs: Date.now(),
    latencyMs: 20,
    contextSize: request.context.length,
    provider: "aliyun",
    model: request.attempt === "final-recovery" ? "qwen-plus" : "qwen-turbo",
    error: "simulated provider failure",
    fallback: true,
    failure: {
      category: "provider",
      message: "simulated provider failure",
      httpStatus: 503,
      providerCode: "ServiceUnavailable"
    },
    attempt: request.attempt ?? "initial"
  };
}

async function requestRealQwen(): Promise<{ text: string; model: string; latencyMs: number }> {
  await loadLocalEnv(resolve(".env"));
  const apiKey = process.env.DASHSCOPE_API_KEY;
  assert.ok(apiKey, "DASHSCOPE_API_KEY is required for the real Qwen smoke test.");
  const configuredModel = process.env.TRANSLATION_MODEL || "qwen-plus";
  const model = configuredModel.startsWith("qwen") ? configuredModel : "qwen-plus";
  const baseUrl = process.env.TRANSLATION_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const startedAtMs = Date.now();
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: buildTranslationMessages({
        text: sourceText,
        sourceLanguage: "English",
        targetLanguage: "Simplified Chinese",
        fastDraft: false,
        context: []
      }),
      temperature: 0.1,
      stream: false
    })
  });
  assert.equal(response.ok, true, `Qwen returned HTTP ${response.status}.`);
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
  assert.equal(validateTranslationText(sourceText, text, languagePair).valid, true);
  return { text, model, latencyMs: Date.now() - startedAtMs };
}

async function main(): Promise<void> {
  const real = await requestRealQwen();
  languagePair.translationModel = real.model;

  globalThis.window = {
    simultaneousInterpretation: {
      getProviderHealth: async () => providerHealth(real.model),
      onTranslationDraft: () => () => undefined,
      translateText: async (request) => ({
        text: request.text,
        provider: "aliyun",
        model: request.model ?? real.model,
        latencyMs: 10
      }),
      cancelTranslation: () => undefined
    }
  } as unknown as Window & typeof globalThis;
  const sourceEcho = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active"
  });
  assert.equal(sourceEcho.failure?.category, "untranslated-output");
  assert.equal(sourceEcho.translatedText, "");

  window.simultaneousInterpretation = {
    getProviderHealth: async () => providerHealth(real.model),
    onTranslationDraft: () => () => undefined,
    translateText: async () => ({
      ok: false,
      text: "",
      provider: "aliyun",
      model: real.model,
      latencyMs: 10,
      failure: {
        category: "provider",
        message: "simulated provider failure",
        httpStatus: 503,
        providerCode: "ServiceUnavailable"
      }
    }),
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  const providerFailure = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active"
  });
  assert.equal(providerFailure.translatedText, "");
  assert.equal(providerFailure.failure?.httpStatus, 503);

  let recoveryDelivered!: (event: TranslationEvent) => void;
  const recoveryResult = new Promise<TranslationEvent>((resolve) => {
    recoveryDelivered = resolve;
  });
  const scheduler = createLowLatencyTranslationScheduler({
    async translate(request) {
      if (request.attempt !== "final-recovery") return failureEvent(request);
      return {
        ...failureEvent(request),
        translatedText: real.text,
        model: real.model,
        error: null,
        fallback: false,
        failure: null
      };
    }
  });
  const initialFailure = await scheduler.schedule({
    segment,
    languagePair,
    context: [],
    nowMs: Date.now(),
    onRecovery: recoveryDelivered
  });
  assert.ok(initialFailure);
  assert.equal(initialFailure.recoveryScheduled, true);

  let issues = applyTranslationEventToIssues({}, initialFailure);
  const issue = getLatestTranslationIssue(issues, segment.id);
  const mainCaption = getTranslatedCaptionText("", issue, "正在生成译文");
  const floatingCaption = getTranslatedCaptionText("", issue, "正在生成译文");
  assert.equal(mainCaption, "翻译暂不可用，正在重试");
  assert.equal(floatingCaption, "翻译暂不可用，正在重试");
  assert.notEqual(mainCaption, sourceText);
  assert.notEqual(floatingCaption, sourceText);

  const failedSubtitles = reconcileSubtitleSegments({
    current: [],
    translationEvents: [initialFailure],
    asrSegments: [segment],
    revisionWindow: 4
  }).segments;
  const failedCue = updateCaptionCueSnapshot({
    current: emptyCaptionCueSnapshot,
    asrSegments: [segment],
    translationEvents: [initialFailure],
    nowMs: Date.now()
  });
  const historyContext = {
    sessionId: "translation-smoke",
    captureEpoch: 0,
    sourceType: "system" as const,
    languagePairId: languagePair.id
  };
  const unavailableHistory = toHistoryRecords(failedSubtitles, historyContext);
  assert.equal(failedCue.active?.translatedText, "");
  assert.equal(unavailableHistory[0].translationAvailable, false);
  assert.notEqual(unavailableHistory[0].translatedText, sourceText);

  const recovery = await recoveryResult;
  issues = applyTranslationEventToIssues(issues, recovery);
  assert.equal(getLatestTranslationIssue(issues, segment.id), null);
  const recoveredSubtitles = reconcileSubtitleSegments({
    current: failedSubtitles,
    translationEvents: [recovery],
    asrSegments: [segment],
    revisionWindow: 4
  }).segments;
  const recoveredHistory = upsertHistoryRecords(
    unavailableHistory,
    toHistoryRecords(recoveredSubtitles, historyContext)
  );
  assert.equal(recoveredHistory.length, 1);
  assert.equal(recoveredHistory[0].translationAvailable, true);
  assert.equal(recoveredHistory[0].translatedText, real.text);

  console.log(JSON.stringify({
    realQwen: {
      model: real.model,
      latencyMs: real.latencyMs,
      targetLanguageValid: true,
      sourceEcho: real.text === sourceText
    },
    simulatedSourceEchoRejected: sourceEcho.failure?.category === "untranslated-output",
    simulatedProviderFailureHidden: providerFailure.translatedText === "",
    finalRecoverySucceeded: recovery.translatedText === real.text,
    mainCaptionAvoidedSourceFallback: mainCaption !== sourceText,
    floatingCaptionAvoidedSourceFallback: floatingCaption !== sourceText,
    historyAvoidedSourceFallback: unavailableHistory[0].translatedText !== sourceText
  }, null, 2));
}

void main();
