import assert from "node:assert/strict";
import { isReadableTranslationDraft, buildTranslationMessages } from "../electron/translationPrompt";
import type { AsrSegment } from "../src/asr/types";
import { createTranslationClient } from "../src/translation/client";
import type { TranslationLanguagePair } from "../src/translation/types";

Object.assign(globalThis, { window: {} });

const languagePair: TranslationLanguagePair = {
  id: "en-zh",
  source: { code: "en-US", label: "英语", translationLocale: "English" },
  target: { code: "zh-CN", label: "中文", translationLocale: "Chinese" },
  translationModel: "qwen-plus"
};

const segment: AsrSegment = {
  id: "stream-segment",
  sourceType: "system",
  text: "Alice ordered 12 realtime translation units.",
  status: "partial",
  startedAtMs: 0,
  endedAtMs: 480,
  updatedAtMs: 10_100,
  latencyMs: 100,
  revision: 1,
  audioEvidenceEndAtMs: 10_000,
  asrReceivedAtMs: 10_100,
  timingCorrelation: "provider-offset"
};

function health(streaming: boolean, fastDraftModel = "qwen-turbo"): ProviderHealth {
  return {
    config: {
      asrProvider: "aliyun",
      asrModel: "fun-asr-realtime",
      asrBaseUrl: "wss://example.invalid",
      translationProvider: "aliyun",
      translationModel: "qwen-plus",
      fastDraftModel,
      fastDraftStreaming: streaming,
      translationBaseUrl: "https://example.invalid",
      refinementProvider: "aliyun",
      refinementModel: "qwen-plus",
      refinementBaseUrl: "https://example.invalid",
      hasOpenAiKey: false,
      hasDeepSeekKey: false,
      hasDashScopeKey: true,
      realtimeEnabled: true,
      canStartRealtime: true,
      missing: [],
      secretsInRenderer: false,
      loadedAtMs: 1
    },
    session: {
      state: "streaming",
      sessionId: "session-1",
      sourceType: "system",
      languagePairId: "en-zh",
      asrProvider: "aliyun",
      translationProvider: "aliyun",
      queue: { depth: 0, maxDepth: 12, dropped: 0, lastSequence: 1, lastPayloadBytes: 1 },
      timing: { correlatedEvents: 1, uncorrelatedEvents: 0 },
      recentLatencyMs: 100,
      error: null,
      startedAtMs: 1,
      updatedAtMs: 1
    }
  };
}

async function main(): Promise<void> {
  assert.equal(isReadableTranslationDraft("你好"), false);
  assert.equal(isReadableTranslationDraft("你好，世界。"), true);
  assert.equal(isReadableTranslationDraft("这是一个足够长的草稿"), true);

  const prompt = buildTranslationMessages({
    text: segment.text,
    sourceLanguage: "English",
    targetLanguage: "Chinese",
    fastDraft: true,
    context: [{ sourceText: "Keep Alice.", translatedText: "保留 Alice。" }]
  });
  assert.equal(prompt.length, 2);
  assert.ok(prompt[0].content.includes("names, numbers"));
  assert.ok(prompt[1].content.includes("Alice"));
  assert.ok(prompt[1].content.includes("12"));

  let draftListener: ((event: TranslationDraftResponse) => void) | null = null;
  let sentRequest: TranslateTextRequest | null = null;
  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(true),
    onTranslationDraft: (listener) => {
      draftListener = listener;
      return () => {
        draftListener = null;
      };
    },
    translateText: async (request) => {
      sentRequest = request;
      draftListener?.({
        requestId: request.requestId ?? "",
        text: "爱丽丝订购了 12 个实时翻译单元",
        provider: "aliyun",
        model: request.model ?? "qwen-turbo",
        latencyMs: 180,
        receivedAtMs: 10_330,
        complete: false
      });
      return {
        text: "爱丽丝订购了 12 个实时翻译单元。",
        provider: "aliyun",
        model: request.model ?? "qwen-turbo",
        latencyMs: 260
      };
    },
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];

  const drafts: string[] = [];
  const streamed = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active",
    translationEligibleAtMs: 10_120,
    translationRequestedAtMs: 10_150,
    onDraft: (event) => drafts.push(`${event.segmentId}:${event.translatedText}`)
  });
  assert.equal(sentRequest?.model, "qwen-turbo");
  assert.equal(sentRequest?.stream, true);
  assert.equal(sentRequest?.fastDraft, true);
  assert.deepEqual(drafts, ["stream-segment:爱丽丝订购了 12 个实时翻译单元"]);
  assert.equal(streamed.complete, true);
  assert.equal(streamed.translatedText, "爱丽丝订购了 12 个实时翻译单元。");

  let fallbackDraftSubscribed = false;
  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(false, "qwen-plus"),
    onTranslationDraft: () => {
      fallbackDraftSubscribed = true;
      return () => undefined;
    },
    translateText: async (request) => ({
      text: "完整响应",
      provider: "aliyun",
      model: request.model ?? "qwen-plus",
      latencyMs: 300
    }),
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  const complete = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active"
  });
  assert.equal(complete.translatedText, "完整响应");
  assert.equal(fallbackDraftSubscribed, false);

  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(false),
    onTranslationDraft: () => () => undefined,
    translateText: async (request) => ({
      text: request.text,
      provider: "aliyun",
      model: request.model ?? "qwen-turbo",
      latencyMs: 220
    }),
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  const untranslated = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active"
  });
  assert.equal(untranslated.translatedText, "");
  assert.equal(untranslated.error, "翻译服务返回了未转换为目标语言的文本。");
  assert.equal(untranslated.failure?.category, "untranslated-output");

  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(false),
    onTranslationDraft: () => () => undefined,
    translateText: async () => ({
      ok: false,
      text: "",
      provider: "aliyun",
      model: "qwen-plus",
      latencyMs: 240,
      failure: {
        category: "provider",
        message: "quota exceeded",
        httpStatus: 429,
        providerCode: "Throttling"
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
  assert.equal(providerFailure.error, "quota exceeded");
  assert.deepEqual(providerFailure.failure, {
    category: "provider",
    message: "quota exceeded",
    httpStatus: 429,
    providerCode: "Throttling"
  });

  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(false),
    onTranslationDraft: () => () => undefined,
    translateText: async () => {
      throw new Error("network unavailable");
    },
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  const networkFailure = await createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active"
  });
  assert.equal(networkFailure.translatedText, "");
  assert.equal(networkFailure.failure?.category, "network");

  let recoveryRequest: TranslateTextRequest | null = null;
  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(true),
    onTranslationDraft: () => () => undefined,
    translateText: async (request) => {
      recoveryRequest = request;
      return {
        text: "爱丽丝订购了 12 个实时翻译单元。",
        provider: "aliyun",
        model: request.model ?? "qwen-plus",
        latencyMs: 280
      };
    },
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  const recovered = await createTranslationClient().translate({
    segment: { ...segment, status: "final" },
    languagePair,
    context: [],
    lane: "backfill",
    attempt: "final-recovery"
  });
  assert.equal(recoveryRequest?.model, "qwen-plus");
  assert.equal(recoveryRequest?.stream, false);
  assert.equal(recoveryRequest?.fastDraft, false);
  assert.equal(recovered.attempt, "final-recovery");

  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(true),
    onTranslationDraft: () => () => undefined,
    translateText: async () => ({
      ok: false,
      text: "",
      provider: "aliyun",
      model: "qwen-turbo",
      latencyMs: 10,
      failure: {
        category: "cancelled",
        message: "translation request aborted",
        httpStatus: null,
        providerCode: null
      }
    }),
    cancelTranslation: () => undefined
  } as Window["simultaneousInterpretation"];
  await assert.rejects(
    createTranslationClient().translate({ segment, languagePair, context: [], lane: "active" }),
    { name: "AbortError" }
  );

  let rejectInvoke!: (error: Error) => void;
  let cancelledRequestId = "";
  window.simultaneousInterpretation = {
    getProviderHealth: async () => health(true),
    onTranslationDraft: () => () => undefined,
    translateText: () =>
      new Promise((_resolve, reject) => {
        rejectInvoke = reject;
      }),
    cancelTranslation: (requestId) => {
      cancelledRequestId = requestId;
      const error = new Error("aborted");
      error.name = "AbortError";
      rejectInvoke(error);
    }
  } as Window["simultaneousInterpretation"];
  const controller = new AbortController();
  const aborted = createTranslationClient().translate({
    segment,
    languagePair,
    context: [],
    lane: "active",
    signal: controller.signal
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  await assert.rejects(aborted, { name: "AbortError" });
  assert.ok(cancelledRequestId.startsWith("translation-stream-segment-1-"));

  console.log("provider streaming checks passed");
}

void main();
