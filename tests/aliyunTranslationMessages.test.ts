import assert from "node:assert/strict";
import { buildTranslationMessages } from "../electron/translationPrompt";

const messages = buildTranslationMessages({
  text: "Welcome to the architecture review.",
  sourceLanguage: "English",
  targetLanguage: "Chinese",
  context: [
    {
      sourceText: "We use realtime ASR.",
      translatedText: "我们使用实时语音识别。"
    }
  ]
});

assert.equal(messages.length, 2);
assert.equal(messages[0].role, "system");
assert.ok(messages[0].content.includes("realtime conference interpreter"));
assert.equal(messages[1].role, "user");
assert.ok(messages[1].content.includes("Translate from English to Chinese."));
assert.ok(messages[1].content.includes("We use realtime ASR."));
assert.ok(messages[1].content.includes("Welcome to the architecture review."));

console.log("aliyun translation message checks passed");
