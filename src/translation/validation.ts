import type { TranslationLanguagePair } from "./types";

export interface TranslationValidationResult {
  valid: boolean;
  reason: "empty" | "untranslated-output" | null;
}

const HAN_PATTERN = /[\p{Script=Han}]/u;
const LATIN_WORD_PATTERN = /[A-Za-z][A-Za-z'-]*/g;

function hasEnglishSourceSignal(text: string): boolean {
  const words = text.match(LATIN_WORD_PATTERN) ?? [];
  if (words.length === 0) return false;
  if (words.length === 1 && /^[A-Z][A-Za-z0-9.-]*$/.test(text.trim())) return false;
  return words.some((word) => /[a-z]{2,}/.test(word));
}

function hasEnglishTargetSignal(text: string): boolean {
  return (text.match(LATIN_WORD_PATTERN) ?? []).some((word) => word.length >= 2);
}

export function validateTranslationText(
  sourceText: string,
  translatedText: string,
  languagePair: Pick<TranslationLanguagePair, "source" | "target">
): TranslationValidationResult {
  const source = sourceText.trim();
  const translated = translatedText.trim();
  if (!translated) return { valid: false, reason: "empty" };

  const targetIsChinese = languagePair.target.code.toLowerCase().startsWith("zh");
  const targetIsEnglish = languagePair.target.code.toLowerCase().startsWith("en");
  const sourceHasEnglish = hasEnglishSourceSignal(source);
  const sourceHasChinese = HAN_PATTERN.test(source);

  if (targetIsChinese && sourceHasEnglish && !HAN_PATTERN.test(translated)) {
    return { valid: false, reason: "untranslated-output" };
  }
  if (targetIsEnglish && sourceHasChinese && !hasEnglishTargetSignal(translated)) {
    return { valid: false, reason: "untranslated-output" };
  }

  return { valid: true, reason: null };
}

