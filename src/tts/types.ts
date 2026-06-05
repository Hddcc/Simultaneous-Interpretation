export type TtsStatus = "disabled" | "idle" | "queued" | "speaking" | "paused" | "error";

export interface TtsQueueItem {
  id: string;
  text: string;
  languageCode: string;
  label: string;
}

export interface TtsSessionState {
  enabled: boolean;
  status: TtsStatus;
  queue: TtsQueueItem[];
  currentItem: TtsQueueItem | null;
  spokenIds: string[];
  error: string | null;
}
