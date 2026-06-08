export interface ProviderTranslationPromptRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
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
