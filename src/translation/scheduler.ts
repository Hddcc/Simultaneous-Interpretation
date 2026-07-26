import type { AsrSegment } from "../asr/types";
import type {
  TranslationClient,
  TranslationEvent,
  TranslationLanguagePair,
  TranslationRequest
} from "./types";

export type TranslationLane = "active" | "backfill";

export interface TranslationSchedulerOptions {
  minPartialCharacters: number;
  minPartialWords: number;
  partialDebounceMs: number;
  cacheLimit: number;
  activePendingLimit: 1;
  backfillQueueLimit: number;
}

export type CatchUpState = "healthy" | "catching-up";

export interface TranslationSchedulerDiagnostics {
  queued: number;
  inFlight: number;
  cacheSize: number;
  droppedStale: number;
  reused: number;
  skippedIneligible: number;
  lastQueuedAgeMs: number | null;
  lastInFlightAgeMs: number | null;
  lastStaleResponseAgeMs: number | null;
  lastVisibleLatencyMs: number | null;
  activeLaneDepth: number;
  backfillDepth: number;
  supersededPartials: number;
  cancellationAttempts: number;
  cancellationSucceeded: number;
  cancellationIgnored: number;
  lateFinalBackfills: number;
  skippedBackfills: number;
  rollbackBlocks: number;
  activeLag: number;
  requestCount: number;
  catchUpState: CatchUpState;
}

interface QueuedJob {
  key: string;
  revisionKey: string;
  segment: AsrSegment;
  languagePair: TranslationLanguagePair;
  context: TranslationRequest["context"];
  lane: TranslationLane;
  enqueuedAtMs: number;
  ordinal: number;
  promise: Promise<TranslationEvent | null>;
  resolve: (event: TranslationEvent | null) => void;
  reject: (error: unknown) => void;
  superseded: boolean;
  onDraft?: (event: TranslationEvent) => void;
}

interface RunningJob {
  job: QueuedJob;
  controller: AbortController;
  requestedAtMs: number;
}

const defaultOptions: TranslationSchedulerOptions = {
  minPartialCharacters: 18,
  minPartialWords: 5,
  partialDebounceMs: 240,
  cacheLimit: 48,
  activePendingLimit: 1,
  backfillQueueLimit: 8
};

function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function hasSentenceBoundary(text: string): boolean {
  return /[.!?。！？]$/.test(text.trim());
}

function createJobKey(segment: AsrSegment, languagePair: TranslationLanguagePair): string {
  return [
    segment.id,
    segment.revision,
    segment.status,
    segment.text,
    languagePair.id,
    languagePair.translationModel
  ].join("::");
}

function createCurrentRevisionKey(segment: AsrSegment, languagePair: TranslationLanguagePair): string {
  return [segment.id, segment.revision, languagePair.id].join("::");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export class LowLatencyTranslationScheduler {
  private readonly options: TranslationSchedulerOptions;
  private readonly cache = new Map<string, TranslationEvent>();
  private readonly pendingByKey = new Map<string, Promise<TranslationEvent | null>>();
  private readonly latestRevisionBySegment = new Map<string, string>();
  private readonly segmentOrdinals = new Map<string, number>();
  private activePending: QueuedJob | null = null;
  private activeRunning: RunningJob | null = null;
  private backfillQueue: QueuedJob[] = [];
  private backfillRunning: RunningJob | null = null;
  private nextOrdinal = 0;
  private latestEligibleOrdinal = 0;
  private latestVisibleOrdinal = 0;
  private droppedStale = 0;
  private reused = 0;
  private skippedIneligible = 0;
  private supersededPartials = 0;
  private cancellationAttempts = 0;
  private cancellationSucceeded = 0;
  private cancellationIgnored = 0;
  private lateFinalBackfills = 0;
  private skippedBackfills = 0;
  private rollbackBlocks = 0;
  private requestCount = 0;
  private lastInFlightAgeMs: number | null = null;
  private lastStaleResponseAgeMs: number | null = null;
  private lastVisibleLatencyMs: number | null = null;

  constructor(
    private readonly client: TranslationClient,
    options: Partial<TranslationSchedulerOptions> = {}
  ) {
    this.options = {
      ...defaultOptions,
      ...options,
      activePendingLimit: 1
    };
  }

  reset(): void {
    this.activeRunning?.controller.abort();
    this.backfillRunning?.controller.abort();
    this.activePending?.resolve(null);
    this.backfillQueue.forEach((job) => job.resolve(null));
    this.cache.clear();
    this.pendingByKey.clear();
    this.latestRevisionBySegment.clear();
    this.segmentOrdinals.clear();
    this.activePending = null;
    this.activeRunning = null;
    this.backfillQueue = [];
    this.backfillRunning = null;
    this.nextOrdinal = 0;
    this.latestEligibleOrdinal = 0;
    this.latestVisibleOrdinal = 0;
    this.droppedStale = 0;
    this.reused = 0;
    this.skippedIneligible = 0;
    this.supersededPartials = 0;
    this.cancellationAttempts = 0;
    this.cancellationSucceeded = 0;
    this.cancellationIgnored = 0;
    this.lateFinalBackfills = 0;
    this.skippedBackfills = 0;
    this.rollbackBlocks = 0;
    this.requestCount = 0;
    this.lastInFlightAgeMs = null;
    this.lastStaleResponseAgeMs = null;
    this.lastVisibleLatencyMs = null;
  }

  shouldTranslate(segment: AsrSegment, nowMs: number): boolean {
    if (segment.status === "final") {
      return true;
    }

    const text = segment.text.trim();
    const stableForMs = Math.max(0, nowMs - segment.updatedAtMs);

    return (
      text.length >= this.options.minPartialCharacters ||
      getWordCount(text) >= this.options.minPartialWords ||
      hasSentenceBoundary(text) ||
      stableForMs >= this.options.partialDebounceMs
    );
  }

  schedule(input: {
    segment: AsrSegment;
    languagePair: TranslationLanguagePair;
    context: TranslationRequest["context"];
    nowMs: number;
    lane?: TranslationLane;
    onDraft?: (event: TranslationEvent) => void;
  }): Promise<TranslationEvent | null> {
    const { segment, languagePair, context, nowMs } = input;
    let lane = input.lane ?? "active";

    if (!this.shouldTranslate(segment, nowMs) || (lane === "backfill" && segment.status !== "final")) {
      this.skippedIneligible += 1;
      return Promise.resolve(null);
    }

    const key = createJobKey(segment, languagePair);
    const revisionKey = createCurrentRevisionKey(segment, languagePair);
    const segmentKey = `${segment.id}::${languagePair.id}`;
    const ordinal = this.getSegmentOrdinal(segment.id);
    if (lane === "active" && ordinal < this.latestEligibleOrdinal) {
      if (segment.status === "final") {
        lane = "backfill";
      } else {
        this.supersededPartials += 1;
        this.droppedStale += 1;
        return Promise.resolve(null);
      }
    }
    this.latestRevisionBySegment.set(segmentKey, revisionKey);
    if (lane === "active") {
      this.latestEligibleOrdinal = Math.max(this.latestEligibleOrdinal, ordinal);
    }

    const cached = this.cache.get(key);
    if (cached) {
      this.reused += 1;
      return Promise.resolve(cached);
    }

    const pending = this.pendingByKey.get(key);
    if (pending) {
      this.reused += 1;
      return pending;
    }

    let resolve!: (event: TranslationEvent | null) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<TranslationEvent | null>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const job: QueuedJob = {
      key,
      revisionKey,
      segment,
      languagePair,
      context,
      lane,
      enqueuedAtMs: nowMs,
      ordinal,
      promise,
      resolve,
      reject,
      superseded: false,
      onDraft: input.onDraft
    };
    this.pendingByKey.set(key, promise);

    if (lane === "backfill") {
      this.enqueueBackfill(job);
    } else {
      this.enqueueActive(job);
    }

    return promise;
  }

  markVisible(segmentId: string, visibleAtMs = Date.now(), segmentUpdatedAtMs?: number): void {
    const ordinal = this.segmentOrdinals.get(segmentId);
    if (ordinal !== undefined) {
      this.latestVisibleOrdinal = Math.max(this.latestVisibleOrdinal, ordinal);
    }
    if (segmentUpdatedAtMs !== undefined) {
      this.lastVisibleLatencyMs = Math.max(0, visibleAtMs - segmentUpdatedAtMs);
    }
  }

  recordRollbackBlock(): void {
    this.rollbackBlocks += 1;
  }

  getDiagnostics(nowMs = Date.now()): TranslationSchedulerDiagnostics {
    const activeLaneDepth = Number(Boolean(this.activeRunning)) + Number(Boolean(this.activePending));
    const backfillDepth = Number(Boolean(this.backfillRunning)) + this.backfillQueue.length;
    const activeLag = Math.max(0, this.latestEligibleOrdinal - this.latestVisibleOrdinal);
    const queuedAtMs = [this.activePending, ...this.backfillQueue]
      .filter((job): job is QueuedJob => Boolean(job))
      .map((job) => job.enqueuedAtMs)
      .sort((left, right) => left - right)[0];

    return {
      queued: Number(Boolean(this.activePending)) + this.backfillQueue.length,
      inFlight: Number(Boolean(this.activeRunning)) + Number(Boolean(this.backfillRunning)),
      cacheSize: this.cache.size,
      droppedStale: this.droppedStale,
      reused: this.reused,
      skippedIneligible: this.skippedIneligible,
      lastQueuedAgeMs: queuedAtMs === undefined ? null : Math.max(0, nowMs - queuedAtMs),
      lastInFlightAgeMs: this.lastInFlightAgeMs,
      lastStaleResponseAgeMs: this.lastStaleResponseAgeMs,
      lastVisibleLatencyMs: this.lastVisibleLatencyMs,
      activeLaneDepth,
      backfillDepth,
      supersededPartials: this.supersededPartials,
      cancellationAttempts: this.cancellationAttempts,
      cancellationSucceeded: this.cancellationSucceeded,
      cancellationIgnored: this.cancellationIgnored,
      lateFinalBackfills: this.lateFinalBackfills,
      skippedBackfills: this.skippedBackfills,
      rollbackBlocks: this.rollbackBlocks,
      activeLag,
      requestCount: this.requestCount,
      catchUpState:
        activeLag > 1 || Boolean(this.activePending) || this.backfillQueue.length >= this.options.backfillQueueLimit
          ? "catching-up"
          : "healthy"
    };
  }

  private getSegmentOrdinal(segmentId: string): number {
    const existing = this.segmentOrdinals.get(segmentId);
    if (existing !== undefined) {
      return existing;
    }
    this.nextOrdinal += 1;
    this.segmentOrdinals.set(segmentId, this.nextOrdinal);
    return this.nextOrdinal;
  }

  private enqueueActive(job: QueuedJob): void {
    if (this.activePending && this.activePending.key !== job.key) {
      this.supersede(this.activePending, "pending");
      this.activePending = null;
    }

    if (
      this.activeRunning &&
      this.activeRunning.job.key !== job.key &&
      !this.activeRunning.job.superseded &&
      this.activeRunning.job.segment.status === "partial" &&
      job.ordinal >= this.activeRunning.job.ordinal
    ) {
      this.activeRunning.job.superseded = true;
      this.supersededPartials += 1;
      this.cancellationAttempts += 1;
      this.activeRunning.controller.abort();
    }

    this.activePending = job;
    this.dispatchActive();
  }

  private enqueueBackfill(job: QueuedJob): void {
    const replaced = this.backfillQueue.filter(
      (queued) => queued.segment.id === job.segment.id && queued.key !== job.key
    );
    replaced.forEach((queued) => this.supersede(queued, "backfill"));
    this.backfillQueue = this.backfillQueue.filter(
      (queued) => queued.segment.id !== job.segment.id || queued.key === job.key
    );
    this.backfillQueue.push(job);

    while (this.backfillQueue.length > this.options.backfillQueueLimit) {
      const dropped = this.backfillQueue.shift();
      if (dropped) {
        this.skippedBackfills += 1;
        this.pendingByKey.delete(dropped.key);
        dropped.resolve(null);
      }
    }
    this.dispatchBackfill();
  }

  private dispatchActive(): void {
    if (this.activeRunning || !this.activePending) {
      return;
    }
    const job = this.activePending;
    this.activePending = null;
    const running = this.createRunningJob(job);
    this.activeRunning = running;
    void this.run(running).finally(() => {
      if (this.activeRunning === running) {
        this.activeRunning = null;
      }
      this.dispatchActive();
    });
  }

  private dispatchBackfill(): void {
    if (this.backfillRunning || this.backfillQueue.length === 0) {
      return;
    }
    const job = this.backfillQueue.shift();
    if (!job) {
      return;
    }
    const running = this.createRunningJob(job);
    this.backfillRunning = running;
    void this.run(running).finally(() => {
      if (this.backfillRunning === running) {
        this.backfillRunning = null;
      }
      this.dispatchBackfill();
    });
  }

  private createRunningJob(job: QueuedJob): RunningJob {
    return {
      job,
      controller: new AbortController(),
      requestedAtMs: Date.now()
    };
  }

  private async run(running: RunningJob): Promise<void> {
    const { job, controller, requestedAtMs } = running;
    this.requestCount += 1;

    try {
      const event = await this.client.translate({
        segment: job.segment,
        languagePair: job.languagePair,
        context: job.context,
        translationEligibleAtMs: job.enqueuedAtMs,
        translationRequestedAtMs: requestedAtMs,
        signal: controller.signal,
        lane: job.lane,
        onDraft: job.onDraft
          ? (event) => {
              const segmentKey = `${job.segment.id}::${job.languagePair.id}`;
              const current = this.latestRevisionBySegment.get(segmentKey) === job.revisionKey;
              if (job.superseded || !current || job.ordinal < this.latestEligibleOrdinal) {
                this.rollbackBlocks += 1;
                return;
              }
              job.onDraft?.({ ...event, lane: "active", historyBackfill: false });
            }
          : undefined
      });
      this.lastInFlightAgeMs = Math.max(0, Date.now() - requestedAtMs);

      if (job.superseded) {
        this.cancellationIgnored += 1;
      }

      const segmentKey = `${job.segment.id}::${job.languagePair.id}`;
      const revisionIsCurrent = this.latestRevisionBySegment.get(segmentKey) === job.revisionKey;
      const activeHasAdvanced = job.lane === "active" && job.ordinal < this.latestEligibleOrdinal;

      if (!revisionIsCurrent || job.superseded || activeHasAdvanced) {
        this.droppedStale += 1;
        this.lastStaleResponseAgeMs = Math.max(0, Date.now() - job.enqueuedAtMs);
        if (job.segment.status === "final" && revisionIsCurrent) {
          this.lateFinalBackfills += 1;
          job.resolve({ ...event, lane: "backfill", historyBackfill: true });
        } else {
          job.resolve(null);
        }
        return;
      }

      const delivered = {
        ...event,
        lane: job.lane,
        historyBackfill: job.lane === "backfill"
      } satisfies TranslationEvent;
      this.cacheEvent(job.key, delivered);
      job.resolve(delivered);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        this.cancellationSucceeded += 1;
        this.droppedStale += 1;
        job.resolve(null);
      } else {
        job.reject(error);
      }
    } finally {
      this.pendingByKey.delete(job.key);
    }
  }

  private supersede(job: QueuedJob, location: "pending" | "backfill"): void {
    job.superseded = true;
    this.pendingByKey.delete(job.key);
    if (job.segment.status === "partial") {
      this.supersededPartials += 1;
    } else if (location === "backfill") {
      this.skippedBackfills += 1;
    }
    this.droppedStale += 1;
    job.resolve(null);
  }

  private cacheEvent(key: string, event: TranslationEvent): void {
    this.cache.set(key, event);
    while (this.cache.size > this.options.cacheLimit) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }
}

export function createLowLatencyTranslationScheduler(
  client: TranslationClient,
  options?: Partial<TranslationSchedulerOptions>
): LowLatencyTranslationScheduler {
  return new LowLatencyTranslationScheduler(client, options);
}
