import type {
  SubtitleRefinementClient,
  SubtitleRefinementEvent,
  SubtitleRefinementRequest
} from "./types";

type RefinementProvider = SubtitleRefinementEvent["provider"];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "字幕润色服务调用失败。";
}

function createRefinementEvent(
  request: SubtitleRefinementRequest,
  input: {
    refinedSourceText: string;
    refinedTranslatedText: string;
    reason: string;
    latencyMs: number;
    provider: RefinementProvider;
    model: string;
    error: string | null;
    fallback: boolean;
  }
): SubtitleRefinementEvent {
  return {
    id: `refinement-${request.segmentId}-${request.revision}`,
    segmentId: request.segmentId,
    sourceText: request.sourceText,
    translatedText: request.translatedText,
    refinedSourceText: input.refinedSourceText || request.sourceText,
    refinedTranslatedText: input.refinedTranslatedText || request.translatedText,
    languagePairId: request.languagePair.id,
    sourceLanguage: request.languagePair.source.label,
    targetLanguage: request.languagePair.target.label,
    revision: request.revision,
    createdAtMs: Date.now(),
    firstDraftVisibleAtMs: request.firstDraftVisibleAtMs ?? null,
    refinementVisibleAtMs: null,
    latencyMs: input.latencyMs,
    contextSize: request.context.length,
    provider: input.provider,
    model: input.model,
    error: input.error,
    fallback: input.fallback,
    reason: input.reason
  };
}

function createMockRefinementEvent(request: SubtitleRefinementRequest): SubtitleRefinementEvent {
  const refinedTranslatedText =
    request.languagePair.target.code === "zh-CN"
      ? request.translatedText
          .replace(/^以及我已将其列在下方的/, "我把")
          .replace("今日主要议题", "今天的主要议题放在下面了")
      : request.translatedText.replace(/^Draft translation:\s*/, "");

  return createRefinementEvent(request, {
    refinedSourceText: request.sourceText,
    refinedTranslatedText,
    reason: "mock natural subtitle refinement",
    latencyMs: 180,
    provider: "mock",
    model: "mock-subtitle-refiner",
    error: null,
    fallback: false
  });
}

async function getProviderHealth(): Promise<ProviderHealth | null> {
  try {
    return (await window.simultaneousInterpretation?.getProviderHealth?.()) ?? null;
  } catch {
    return null;
  }
}

async function refineWithProvider(request: SubtitleRefinementRequest): Promise<SubtitleRefinementEvent> {
  const api = window.simultaneousInterpretation;
  const health = await getProviderHealth();
  const provider = health?.config.refinementProvider ?? health?.config.translationProvider ?? "mock";
  const model =
    health?.config.refinementModel ??
    health?.config.translationModel ??
    request.languagePair.translationModel;

  if (provider === "mock" || !api?.refineSubtitle) {
    return createMockRefinementEvent(request);
  }

  const startedAtMs = Date.now();

  try {
    const response = await api.refineSubtitle({
      sourceText: request.sourceText,
      translatedText: request.translatedText,
      sourceLanguage: request.languagePair.source.translationLocale,
      targetLanguage: request.languagePair.target.translationLocale,
      model,
      context: request.context,
      terminologyHints: request.terminologyHints
    });

    return createRefinementEvent(request, {
      refinedSourceText: response.refinedSourceText,
      refinedTranslatedText: response.refinedTranslatedText,
      reason: response.reason,
      latencyMs: response.latencyMs,
      provider: response.provider,
      model: response.model,
      error: null,
      fallback: false
    });
  } catch (error) {
    return createRefinementEvent(request, {
      refinedSourceText: request.sourceText,
      refinedTranslatedText: request.translatedText,
      reason: "refinement fallback",
      latencyMs: Date.now() - startedAtMs,
      provider,
      model,
      error: getErrorMessage(error),
      fallback: true
    });
  }
}

export function createSubtitleRefinementClient(): SubtitleRefinementClient {
  return {
    refine(request: SubtitleRefinementRequest) {
      return refineWithProvider(request);
    }
  };
}
