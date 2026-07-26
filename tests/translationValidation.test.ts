import assert from "node:assert/strict";
import { validateTranslationText } from "../src/translation/validation";
import type { TranslationLanguagePair } from "../src/translation/types";

const enToZh: TranslationLanguagePair = {
  id: "en-zh",
  source: { code: "en-US", label: "英语", translationLocale: "English" },
  target: { code: "zh-CN", label: "中文", translationLocale: "Chinese" },
  translationModel: "qwen-plus"
};
const zhToEn: TranslationLanguagePair = {
  id: "zh-en",
  source: enToZh.target,
  target: enToZh.source,
  translationModel: "qwen-plus"
};

assert.equal(validateTranslationText("The meeting starts now.", "会议现在开始。", enToZh).valid, true);
assert.equal(validateTranslationText("The meeting starts now.", "The meeting starts now.", enToZh).valid, false);
assert.equal(validateTranslationText("Deploy Qwen 2 now", "Deploy Qwen 2 now", enToZh).valid, false);
assert.equal(validateTranslationText("Deploy Qwen 2 now", "现在部署 Qwen 2", enToZh).valid, true);
assert.equal(validateTranslationText("Alice", "Alice", enToZh).valid, true);
assert.equal(validateTranslationText("API", "API", enToZh).valid, true);
assert.equal(validateTranslationText("2026 / Q3", "2026 / Q3", enToZh).valid, true);

assert.equal(validateTranslationText("会议现在开始。", "The meeting starts now.", zhToEn).valid, true);
assert.equal(validateTranslationText("会议现在开始。", "会议现在开始。", zhToEn).valid, false);
assert.equal(validateTranslationText("版本 2.0", "Version 2.0", zhToEn).valid, true);
assert.equal(validateTranslationText("123", "123", zhToEn).valid, true);
assert.equal(validateTranslationText("hello", "   ", enToZh).reason, "empty");

console.log("translation validation checks passed");
