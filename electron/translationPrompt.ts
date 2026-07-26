export interface ProviderTranslationPromptRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  fastDraft?: boolean;
  context?: Array<{
    sourceText: string;
    translatedText: string;
  }>;
}

export function buildTranslationContextText(request: ProviderTranslationPromptRequest): string {
  if (!request.context || request.context.length === 0) {
    return "No previous subtitle context.";
  }

  return request.context
    .map((item, index) => `${index + 1}. ${item.sourceText} => ${item.translatedText}`)
    .join("\n");
}

export function buildTranslationMessages(request: ProviderTranslationPromptRequest) {
  if (request.fastDraft) {
    const recent = request.context?.at(-1);
    const context = recent
      ? ` Context: ${recent.sourceText} => ${recent.translatedText}.`
      : "";
    return [
      {
        role: "system",
        content:
          "Translate for live subtitles. Preserve language direction, names, numbers, and key terms. Return translated text only."
      },
      {
        role: "user",
        content: `${request.sourceLanguage} to ${request.targetLanguage}.${context} Text: ${request.text}`
      }
    ];
  }

  const contextText = buildTranslationContextText(request);

  return [
    {
      role: "system",
      content:
        "You are a realtime conference interpreter. Translate faithfully, keep terminology stable, use recent context for correction, and return only the translated text."
    },
    {
      role: "user",
      content: `Translate from ${request.sourceLanguage} to ${request.targetLanguage}.\n\nRecent context:\n${contextText}\n\nText:\n${request.text}`
    }
  ];
}

export function isReadableTranslationDraft(text: string, minimumCharacters = 6): boolean {
  const trimmed = text.trim();
  if (trimmed.length < minimumCharacters) {
    return false;
  }
  return /[\s,.;:!?，。；：！？]$/.test(trimmed) || trimmed.length >= minimumCharacters + 4;
}

export interface ProviderSubtitleRefinementPromptRequest {
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  context?: Array<{
    sourceText: string;
    translatedText: string;
  }>;
  terminologyHints?: string[];
}

function buildTerminologyText(terms: string[] | undefined): string {
  if (!terms || terms.length === 0) {
    return "No explicit terminology hints.";
  }

  return terms.map((term) => `- ${term}`).join("\n");
}

export function buildSubtitleRefinementMessages(request: ProviderSubtitleRefinementPromptRequest) {
  const contextText = buildTranslationContextText({
    text: request.sourceText,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    context: request.context
  });
  const terminologyText = buildTerminologyText(request.terminologyHints);

  return [
    {
      role: "system",
      content:
        "You are a bilingual subtitle refinement editor for realtime interpretation. Improve naturalness in both source and translated subtitles while preserving meaning, speaker intent, technical terms, names, numbers, formulas, and language direction. Return strict JSON only."
    },
    {
      role: "user",
      content:
        `Source language: ${request.sourceLanguage}\n` +
        `Target language: ${request.targetLanguage}\n\n` +
        `Recent context:\n${contextText}\n\n` +
        `Terminology hints:\n${terminologyText}\n\n` +
        `Source subtitle:\n${request.sourceText}\n\n` +
        `Translated subtitle:\n${request.translatedText}\n\n` +
        "Return JSON with keys: refinedSourceText, refinedTranslatedText, reason. Keep subtitles concise and natural."
    }
  ];
}

export function parseSubtitleRefinementJson(text: string): {
  refinedSourceText: string;
  refinedTranslatedText: string;
  reason: string;
} {
  const trimmed = text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(trimmed) as Partial<{
    refinedSourceText: string;
    refinedTranslatedText: string;
    reason: string;
  }>;

  return {
    refinedSourceText: parsed.refinedSourceText?.trim() || "",
    refinedTranslatedText: parsed.refinedTranslatedText?.trim() || "",
    reason: parsed.reason?.trim() || "refined for natural subtitle reading"
  };
}
