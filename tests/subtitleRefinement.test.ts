import assert from "node:assert/strict";
import {
  buildSubtitleRefinementMessages,
  parseSubtitleRefinementJson
} from "../electron/translationPrompt";
import { createSubtitleRefinementClient } from "../src/translation/refinementClient";
import type { SubtitleRefinementRequest, TranslationLanguagePair } from "../src/translation/types";

const messages = buildSubtitleRefinementMessages({
  sourceText: "And I've put below my main topics for today.",
  translatedText: "以及我已将其列在下方的今日主要议题。",
  sourceLanguage: "English",
  targetLanguage: "Chinese",
  terminologyHints: ["DashScope", "Qwen"],
  context: [
    {
      sourceText: "Welcome everyone.",
      translatedText: "欢迎大家。"
    }
  ]
});

assert.equal(messages.length, 2);
assert.ok(messages[0].content.includes("preserving meaning"));
assert.ok(messages[1].content.includes("Return JSON"));
assert.ok(messages[1].content.includes("DashScope"));

const parsed = parseSubtitleRefinementJson(
  JSON.stringify({
    refinedSourceText: "I've listed today's main topics below.",
    refinedTranslatedText: "我把今天的主要议题放在下面了。",
    reason: "remove translationese"
  })
);

assert.equal(parsed.refinedSourceText, "I've listed today's main topics below.");
assert.equal(parsed.refinedTranslatedText, "我把今天的主要议题放在下面了。");
assert.equal(parsed.reason, "remove translationese");

async function main(): Promise<void> {
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

  const request: SubtitleRefinementRequest = {
    segmentId: "segment-1",
    sourceText: "And I've put below my main topics for today.",
    translatedText: "以及我已将其列在下方的今日主要议题。",
    languagePair,
    context: [],
    revision: 2,
    status: "final",
    terminologyHints: []
  };

  globalThis.window = {
    simultaneousInterpretation: {
      getProviderHealth: async () =>
        ({
          config: {
            translationProvider: "mock",
            translationModel: "mock-bilingual-translator",
            refinementProvider: "mock",
            refinementModel: "mock-subtitle-refiner"
          }
        }) as ProviderHealth
    }
  } as unknown as Window & typeof globalThis;

  const refined = await createSubtitleRefinementClient().refine(request);
  assert.equal(refined.provider, "mock");
  assert.equal(refined.model, "mock-subtitle-refiner");
  assert.equal(refined.error, null);
  assert.ok(refined.refinedTranslatedText.includes("今天"));

  console.log("subtitle refinement checks passed");
}

void main();
