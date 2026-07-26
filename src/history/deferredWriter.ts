import type { HistoryRecord } from "./types";

export interface HistoryWriterOptions {
  commit(records: HistoryRecord[]): void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
  setTimer?: (callback: () => void, delayMs: number) => number;
  clearTimer?: (id: number) => void;
  delayMs?: number;
}

export interface DeferredHistoryWriter {
  enqueue(records: HistoryRecord[]): void;
  flush(): void;
  dispose(): void;
}

export function createDeferredHistoryWriter(options: HistoryWriterOptions): DeferredHistoryWriter {
  const pending = new Map<string, HistoryRecord>();
  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = options.cancelFrame ?? window.cancelAnimationFrame.bind(window);
  const setTimer = options.setTimer ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? window.clearTimeout.bind(window);
  let frameId: number | null = null;
  let timerId: number | null = null;

  function flush(): void {
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    if (timerId !== null) {
      clearTimer(timerId);
      timerId = null;
    }

    const incoming = [...pending.values()];
    pending.clear();
    if (incoming.length > 0) {
      options.commit(incoming);
    }
  }

  function enqueue(records: HistoryRecord[]): void {
    records.forEach((record) => pending.set(record.id, record));
    if (pending.size === 0 || frameId !== null || timerId !== null) {
      return;
    }

    frameId = requestFrame(() => {
      frameId = null;
      timerId = setTimer(() => {
        timerId = null;
        flush();
      }, options.delayMs ?? 250);
    });
  }

  return {
    enqueue,
    flush,
    dispose: flush
  };
}
