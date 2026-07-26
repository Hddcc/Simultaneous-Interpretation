import type { HistoryGroup, HistoryRecord } from "./types";

export const HISTORY_GROUP_GAP_MS = 8_000;

function joinText(left: string, right: string): string {
  const current = left.trimEnd();
  const incoming = right.trimStart();
  if (!current) return incoming;
  if (!incoming) return current;

  const noLeadingSpace = /^[,.;:!?，。；：！？、）】》]/u.test(incoming);
  const joinsCjk = /[\p{Script=Han}，。；：！？、（【《]$/u.test(current) &&
    /^[\p{Script=Han}，。；：！？、）】》]/u.test(incoming);
  return `${current}${noLeadingSpace || joinsCjk ? "" : " "}${incoming}`;
}

function createGroup(record: HistoryRecord): HistoryGroup {
  return {
    id: record.id,
    startedAtMs: record.startedAtMs,
    endedAtMs: record.endedAtMs,
    sourceText: record.sourceText,
    translatedText: record.translatedText,
    revised: record.revised,
    records: [record]
  };
}

function appendRecord(group: HistoryGroup, record: HistoryRecord): void {
  group.endedAtMs = Math.max(group.endedAtMs, record.endedAtMs);
  group.sourceText = joinText(group.sourceText, record.sourceText);
  group.translatedText = joinText(group.translatedText, record.translatedText);
  group.revised = group.revised || record.revised;
  group.records.push(record);
}

export function groupHistoryRecords(records: HistoryRecord[]): HistoryGroup[] {
  const streams = new Map<string, HistoryRecord[]>();
  records.forEach((record) => {
    const key = `${record.sessionId}\u0000${record.sourceType}\u0000${record.languagePairId}`;
    const stream = streams.get(key);
    if (stream) {
      stream.push(record);
    } else {
      streams.set(key, [record]);
    }
  });

  const groups: HistoryGroup[] = [];

  streams.forEach((stream) => {
    const ordered = [...stream].sort((left, right) => left.startedAtMs - right.startedAtMs);
    let current: HistoryGroup | null = null;
    for (const record of ordered) {
      if (current && record.startedAtMs - current.endedAtMs <= HISTORY_GROUP_GAP_MS) {
        appendRecord(current, record);
      } else {
        current = createGroup(record);
        groups.push(current);
      }
    }
  });

  const updatedAtByGroup = new Map(
    groups.map((group) => [
      group.id,
      group.records.reduce((latest, record) => Math.max(latest, record.updatedAtMs), 0)
    ])
  );
  return groups.sort(
    (left, right) => (updatedAtByGroup.get(right.id) ?? 0) - (updatedAtByGroup.get(left.id) ?? 0)
  );
}
