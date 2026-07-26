import type { TranslationEvent, TranslationFailureCategory } from "./types";

export interface TranslationIssue {
  segmentId: string;
  revision: number;
  provider: TranslationEvent["provider"];
  model: string;
  category: TranslationFailureCategory;
  message: string;
  httpStatus: number | null;
  providerCode: string | null;
  firstFailedAtMs: number;
  lastFailedAtMs: number;
  recoveryAttempted: boolean;
  recoveryPending: boolean;
}

export type TranslationIssues = Record<string, TranslationIssue>;

export function createTranslationIssueKey(segmentId: string, revision: number): string {
  return `${segmentId}::${revision}`;
}

export function getLatestTranslationIssue(
  issues: TranslationIssues,
  segmentId: string | undefined
): TranslationIssue | null {
  if (!segmentId) return null;

  return Object.values(issues)
    .filter((issue) => issue.segmentId === segmentId)
    .sort((left, right) => right.revision - left.revision || right.lastFailedAtMs - left.lastFailedAtMs)[0] ?? null;
}

export function getTranslationIssueLabel(issue: TranslationIssue | null): string | null {
  if (!issue) return null;
  return issue.recoveryPending ? "翻译暂不可用，正在重试" : "翻译暂不可用";
}

export function getTranslatedCaptionText(
  translatedText: string | undefined,
  issue: TranslationIssue | null,
  pendingText: string
): string {
  return translatedText?.trim() || getTranslationIssueLabel(issue) || pendingText;
}

export function applyTranslationEventToIssues(
  current: TranslationIssues,
  event: TranslationEvent
): TranslationIssues {
  if (!event.error && event.translatedText.trim()) {
    const entries = Object.entries(current).filter(
      ([, issue]) => issue.segmentId !== event.segmentId || issue.revision > event.revision
    );
    return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries);
  }
  if (!event.error || event.failure?.category === "cancelled") return current;

  const key = createTranslationIssueKey(event.segmentId, event.revision);
  const existing = current[key];
  return {
    ...current,
    [key]: {
      segmentId: event.segmentId,
      revision: event.revision,
      provider: event.provider,
      model: event.model,
      category: event.failure?.category ?? "provider",
      message: event.error,
      httpStatus: event.failure?.httpStatus ?? null,
      providerCode: event.failure?.providerCode ?? null,
      firstFailedAtMs: existing?.firstFailedAtMs ?? event.createdAtMs,
      lastFailedAtMs: event.createdAtMs,
      recoveryAttempted: existing?.recoveryAttempted || event.attempt === "final-recovery",
      recoveryPending: Boolean(event.recoveryScheduled)
    }
  };
}
