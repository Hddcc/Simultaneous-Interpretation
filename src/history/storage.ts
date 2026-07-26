import type { HistoryGroup, HistoryRecord, HistoryStore } from "./types";

export const HISTORY_STORAGE_KEY = "lingua-bridge.subtitle-history.v1";
export const HISTORY_LIMIT = 500;

export interface HistoryStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.sessionId === "string" &&
    typeof record.segmentId === "string" &&
    (record.sourceType === "system" || record.sourceType === "microphone" || record.sourceType === "file") &&
    typeof record.languagePairId === "string" &&
    typeof record.sourceLanguage === "string" &&
    typeof record.targetLanguage === "string" &&
    typeof record.sourceText === "string" &&
    typeof record.translatedText === "string" &&
    (record.translationAvailable === undefined || typeof record.translationAvailable === "boolean") &&
    typeof record.startedAtMs === "number" &&
    Number.isFinite(record.startedAtMs) &&
    typeof record.endedAtMs === "number" &&
    Number.isFinite(record.endedAtMs) &&
    typeof record.updatedAtMs === "number" &&
    Number.isFinite(record.updatedAtMs) &&
    typeof record.revised === "boolean"
  );
}

export function upsertHistoryRecords(
  current: HistoryRecord[],
  incoming: HistoryRecord[]
): HistoryRecord[] {
  const normalize = (record: HistoryRecord): HistoryRecord => ({
    ...record,
    translationAvailable: record.translationAvailable ?? Boolean(record.translatedText.trim())
  });
  const byId = new Map(current.map((record) => [record.id, normalize(record)]));
  incoming.forEach((record) => byId.set(record.id, normalize(record)));
  return [...byId.values()]
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)
    .slice(0, HISTORY_LIMIT);
}

export function loadHistory(storage: HistoryStorageLike): HistoryRecord[] {
  try {
    const raw = storage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<HistoryStore>;
    if (parsed.version !== 1 || !Array.isArray(parsed.records) || !parsed.records.every(isHistoryRecord)) {
      return [];
    }

    return upsertHistoryRecords([], parsed.records);
  } catch {
    return [];
  }
}

export function saveHistory(storage: HistoryStorageLike, records: HistoryRecord[]): void {
  const store: HistoryStore = {
    version: 1,
    records: upsertHistoryRecords([], records)
  };
  storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
}

export function clearHistory(storage: HistoryStorageLike): void {
  storage.removeItem(HISTORY_STORAGE_KEY);
}

function formatHistoryTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  const milliseconds = Math.floor(ms % 1000).toString().padStart(3, "0");
  return `${minutes}:${seconds}.${milliseconds}`;
}

export function serializeHistoryText(groups: HistoryGroup[]): string {
  return [...groups]
    .reverse()
    .map((group) => {
      const timestamp = formatHistoryTimestamp(group.startedAtMs);
      const unavailable = group.translationAvailable ? "" : "[译文暂不可用]";
      const translation = [group.translatedText, unavailable].filter(Boolean).join("\n");
      return `[${timestamp}]\n${group.sourceText}\n${translation}`;
    })
    .join("\n\n");
}
