export interface LanguageConfig {
  code: string;
  label: string;
  asrLocale: string;
  translationLocale: string;
}

export interface LanguagePair {
  id: string;
  label: string;
  source: LanguageConfig;
  target: LanguageConfig;
  translationModel: string;
}

export const LANGUAGE_PREFERENCE_KEY = "simultaneous-interpretation.language-pair";

const DEFAULT_TRANSLATION_MODEL =
  import.meta.env.VITE_TRANSLATION_MODEL || "mock-bilingual-translator";

export const supportedLanguagePairs: LanguagePair[] = [
  {
    id: "en-US_to_zh-CN",
    label: "英语 -> 中文",
    source: {
      code: "en-US",
      label: "英语",
      asrLocale: "en-US",
      translationLocale: "English"
    },
    target: {
      code: "zh-CN",
      label: "中文",
      asrLocale: "zh-CN",
      translationLocale: "Simplified Chinese"
    },
    translationModel: DEFAULT_TRANSLATION_MODEL
  },
  {
    id: "zh-CN_to_en-US",
    label: "中文 -> 英语",
    source: {
      code: "zh-CN",
      label: "中文",
      asrLocale: "zh-CN",
      translationLocale: "Simplified Chinese"
    },
    target: {
      code: "en-US",
      label: "英语",
      asrLocale: "en-US",
      translationLocale: "English"
    },
    translationModel: DEFAULT_TRANSLATION_MODEL
  }
];

export function getLanguagePair(pairId: string | null | undefined): LanguagePair {
  return (
    supportedLanguagePairs.find((pair) => pair.id === pairId) ??
    supportedLanguagePairs[0]
  );
}

export function loadPreferredLanguagePair(): LanguagePair {
  if (typeof window === "undefined") {
    return supportedLanguagePairs[0];
  }

  return getLanguagePair(window.localStorage.getItem(LANGUAGE_PREFERENCE_KEY));
}

export function savePreferredLanguagePair(pairId: string): void {
  window.localStorage.setItem(LANGUAGE_PREFERENCE_KEY, pairId);
}
