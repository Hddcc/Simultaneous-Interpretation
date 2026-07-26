import type {
  SubtitleRefinementClient,
  SubtitleRefinementEvent,
  SubtitleRefinementRequest
} from "./types";
import { percentile, type LatencyDistribution } from "../realtime/latency";

export type RefinementPauseReason =
  | "active-lag"
  | "translation-backlog"
  | "asr-queue-pressure"
  | "fast-draft-latency";

export interface RefinementPressureInput {
  activeLag: number;
  translationBacklog: number;
  asrQueueRatio: number;
  fastDraftLatencyMs: number | null;
}

export interface RefinementSchedulerOptions {
  maxQueueDepth: number;
  cacheLimit: number;
  minStableCharacters: number;
  maxActiveLag: number;
  maxTranslationBacklog: number;
  maxAsrQueueRatio: number;
  maxFastDraftLatencyMs: number;
  latencySampleLimit: number;
}

export interface RefinementSchedulerDiagnostics {
  queued: number;
  inFlight: number;
  cacheSize: number;
  droppedStale: number;
  droppedQueuePressure: number;
  reused: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  paused: boolean;
  pauseReason: RefinementPauseReason | null;
  skippedWhilePaused: number;
  resumed: number;
  latencyDistribution: LatencyDistribution;
}

interface QueuedRefinementJob {
  key: string;
  revisionKey: string;
  request: SubtitleRefinementRequest;
  enqueuedAtMs: number;
}

const defaultOptions: RefinementSchedulerOptions = {
  maxQueueDepth: 3,
  cacheLimit: 32,
  minStableCharacters: 8,
  maxActiveLag: 1,
  maxTranslationBacklog: 2,
  maxAsrQueueRatio: 0.5,
  maxFastDraftLatencyMs: 900,
  latencySampleLimit: 128
};

function createJobKey(request: SubtitleRefinementRequest): string {
  return [
    request.segmentId,
    request.revision,
    request.sourceText,
    request.translatedText,
    request.languagePair.id,
    request.languagePair.translationModel
  ].join("::");
}

function createRevisionKey(request: SubtitleRefinementRequest): string {
  return [request.segmentId, request.revision, request.languagePair.id].join("::");
}

export class SubtitleRefinementScheduler {
  private readonly options: RefinementSchedulerOptions;
  private readonly cache = new Map<string, SubtitleRefinementEvent>();
  private readonly inFlight = new Map<string, Promise<SubtitleRefinementEvent>>();
  private readonly latestRevisionBySegment = new Map<string, string>();
  private queued: QueuedRefinementJob[] = [];
  private droppedStale = 0;
  private droppedQueuePressure = 0;
  private reused = 0;
  private lastLatencyMs: number | null = null;
  private lastError: string | null = null;
  private paused = false;
  private pauseReason: RefinementPauseReason | null = null;
  private skippedWhilePaused = 0;
  private resumed = 0;
  private latencySamples: number[] = [];

  constructor(
    private readonly client: SubtitleRefinementClient,
    options: Partial<RefinementSchedulerOptions> = {}
  ) {
    this.options = { ...defaultOptions, ...options };
  }

  reset(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.latestRevisionBySegment.clear();
    this.queued = [];
    this.droppedStale = 0;
    this.droppedQueuePressure = 0;
    this.reused = 0;
    this.lastLatencyMs = null;
    this.lastError = null;
    this.paused = false;
    this.pauseReason = null;
    this.skippedWhilePaused = 0;
    this.resumed = 0;
    this.latencySamples = [];
  }

  updatePressure(input: RefinementPressureInput): void {
    const nextReason: RefinementPauseReason | null =
      input.activeLag > this.options.maxActiveLag
        ? "active-lag"
        : input.translationBacklog > this.options.maxTranslationBacklog
          ? "translation-backlog"
          : input.asrQueueRatio > this.options.maxAsrQueueRatio
            ? "asr-queue-pressure"
            : input.fastDraftLatencyMs !== null &&
                input.fastDraftLatencyMs > this.options.maxFastDraftLatencyMs
              ? "fast-draft-latency"
              : null;

    if (this.paused && nextReason === null) {
      this.resumed += 1;
    }
    this.paused = nextReason !== null;
    this.pauseReason = nextReason;
  }

  shouldRefine(request: SubtitleRefinementRequest): boolean {
    if (!request.translatedText.trim()) {
      return false;
    }

    if (request.status === "partial") {
      return false;
    }

    return (
      request.sourceText.trim().length >= this.options.minStableCharacters ||
      request.translatedText.trim().length >= this.options.minStableCharacters
    );
  }

  async schedule(request: SubtitleRefinementRequest, nowMs = Date.now()): Promise<SubtitleRefinementEvent | null> {
    if (this.paused) {
      this.skippedWhilePaused += 1;
      return null;
    }

    if (!this.shouldRefine(request)) {
      return null;
    }

    const key = createJobKey(request);
    const revisionKey = createRevisionKey(request);
    const segmentKey = `${request.segmentId}::${request.languagePair.id}`;
    this.latestRevisionBySegment.set(segmentKey, revisionKey);

    const cached = this.cache.get(key);
    if (cached) {
      this.reused += 1;
      return cached;
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      this.reused += 1;
      return existing;
    }

    this.queued = this.queued.filter((job) => job.request.segmentId !== request.segmentId);
    this.queued.push({ key, revisionKey, request, enqueuedAtMs: nowMs });
    while (this.queued.length > this.options.maxQueueDepth) {
      this.queued.shift();
      this.droppedQueuePressure += 1;
    }

    const job = this.client.refine(request).then((event) => {
      this.inFlight.delete(key);
      this.queued = this.queued.filter((queued) => queued.key !== key);

      if (this.latestRevisionBySegment.get(segmentKey) !== revisionKey) {
        this.droppedStale += 1;
        return {
          ...event,
          error: event.error ?? "stale-refinement-result",
          fallback: true
        };
      }

      this.cache.set(key, event);
      while (this.cache.size > this.options.cacheLimit) {
        const oldestKey = this.cache.keys().next().value as string | undefined;
        if (!oldestKey) {
          break;
        }
        this.cache.delete(oldestKey);
      }
      this.lastLatencyMs = event.latencyMs;
      this.lastError = event.error;
      if (!event.error && !event.fallback) {
        this.latencySamples.push(event.latencyMs);
        this.latencySamples = this.latencySamples.slice(-this.options.latencySampleLimit);
      }
      return event;
    });

    this.inFlight.set(key, job);
    const event = await job;

    if (event.error === "stale-refinement-result") {
      return null;
    }

    return event;
  }

  getDiagnostics(): RefinementSchedulerDiagnostics {
    const count = this.latencySamples.length;
    const latencyDistribution: LatencyDistribution = {
      count,
      mean:
        count === 0
          ? null
          : this.latencySamples.reduce((total, value) => total + value, 0) / count,
      p50: percentile(this.latencySamples, 0.5),
      p95: percentile(this.latencySamples, 0.95),
      max: count === 0 ? null : Math.max(...this.latencySamples)
    };

    return {
      queued: this.queued.length,
      inFlight: this.inFlight.size,
      cacheSize: this.cache.size,
      droppedStale: this.droppedStale,
      droppedQueuePressure: this.droppedQueuePressure,
      reused: this.reused,
      lastLatencyMs: this.lastLatencyMs,
      lastError: this.lastError,
      paused: this.paused,
      pauseReason: this.pauseReason,
      skippedWhilePaused: this.skippedWhilePaused,
      resumed: this.resumed,
      latencyDistribution
    };
  }
}

export function createSubtitleRefinementScheduler(
  client: SubtitleRefinementClient,
  options?: Partial<RefinementSchedulerOptions>
): SubtitleRefinementScheduler {
  return new SubtitleRefinementScheduler(client, options);
}
