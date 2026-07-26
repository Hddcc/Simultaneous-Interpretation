import type { RealtimePipelineTiming } from "../translation/types";

export type LatencyMetricName = "fastDraft" | "endToEnd" | "final" | "refinement";

export interface RealtimeLatencyValues {
  fastDraftMs: number | null;
  endToEndMs: number | null;
  finalMs: number | null;
  refinementMs: number | null;
}

export interface ProviderLatencySample extends RealtimePipelineTiming {
  id: string;
  providerBacked: boolean;
  fallback: boolean;
  error: string | null;
}

export interface LatencyDistribution {
  count: number;
  mean: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export interface SessionLatencySnapshot {
  fastDraft: LatencyDistribution;
  endToEnd: LatencyDistribution;
  final: LatencyDistribution;
  refinement: LatencyDistribution;
  errors: number;
  fallbacks: number;
  missingTimestamps: Record<LatencyMetricName, number>;
  retainedSamples: number;
}

function elapsed(startAtMs: number | null | undefined, endAtMs: number | null | undefined): number | null {
  if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs)) {
    return null;
  }

  const duration = (endAtMs as number) - (startAtMs as number);
  return duration >= 0 ? duration : null;
}

export function calculateRealtimeLatencies(timing: RealtimePipelineTiming): RealtimeLatencyValues {
  return {
    fastDraftMs: elapsed(timing.translationEligibleAtMs, timing.firstDraftVisibleAtMs),
    endToEndMs: elapsed(timing.audioEvidenceEndAtMs, timing.firstDraftVisibleAtMs),
    finalMs: elapsed(timing.translationEligibleAtMs, timing.finalVisibleAtMs),
    refinementMs: elapsed(timing.firstDraftVisibleAtMs, timing.refinementVisibleAtMs)
  };
}

export function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1));
  return sorted[rank];
}

function distribution(values: number[]): LatencyDistribution {
  if (values.length === 0) {
    return { count: 0, mean: null, p50: null, p95: null, max: null };
  }

  return {
    count: values.length,
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: Math.max(...values)
  };
}

function preserveFirstDraftTiming(
  existing: ProviderLatencySample,
  update: ProviderLatencySample
): ProviderLatencySample {
  return {
    ...existing,
    ...update,
    audioEvidenceEndAtMs: existing.audioEvidenceEndAtMs ?? update.audioEvidenceEndAtMs,
    asrReceivedAtMs: existing.asrReceivedAtMs ?? update.asrReceivedAtMs,
    translationEligibleAtMs: existing.translationEligibleAtMs ?? update.translationEligibleAtMs,
    translationRequestedAtMs: existing.translationRequestedAtMs ?? update.translationRequestedAtMs,
    firstDraftReceivedAtMs: existing.firstDraftReceivedAtMs ?? update.firstDraftReceivedAtMs,
    firstDraftVisibleAtMs: existing.firstDraftVisibleAtMs ?? update.firstDraftVisibleAtMs
  };
}

export class SessionLatencyAggregator {
  private readonly samples = new Map<string, ProviderLatencySample>();

  constructor(private readonly maxSamples = 256) {}

  reset(): void {
    this.samples.clear();
  }

  record(sample: ProviderLatencySample): void {
    const existing = this.samples.get(sample.id);
    this.samples.delete(sample.id);
    this.samples.set(sample.id, existing ? preserveFirstDraftTiming(existing, sample) : sample);

    while (this.samples.size > this.maxSamples) {
      const oldestKey = this.samples.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.samples.delete(oldestKey);
    }
  }

  getSample(id: string): ProviderLatencySample | null {
    return this.samples.get(id) ?? null;
  }

  snapshot(): SessionLatencySnapshot {
    const values: Record<LatencyMetricName, number[]> = {
      fastDraft: [],
      endToEnd: [],
      final: [],
      refinement: []
    };
    const missingTimestamps: Record<LatencyMetricName, number> = {
      fastDraft: 0,
      endToEnd: 0,
      final: 0,
      refinement: 0
    };
    let errors = 0;
    let fallbacks = 0;

    this.samples.forEach((sample) => {
      if (sample.error) {
        errors += 1;
      }
      if (sample.fallback) {
        fallbacks += 1;
      }
      if (!sample.providerBacked || sample.error || sample.fallback) {
        return;
      }

      const metrics = calculateRealtimeLatencies(sample);
      const pairs: Array<[LatencyMetricName, number | null]> = [
        ["fastDraft", metrics.fastDraftMs],
        ["endToEnd", metrics.endToEndMs],
        ["final", metrics.finalMs],
        ["refinement", metrics.refinementMs]
      ];

      pairs.forEach(([name, value]) => {
        if (value === null) {
          missingTimestamps[name] += 1;
        } else {
          values[name].push(value);
        }
      });
    });

    return {
      fastDraft: distribution(values.fastDraft),
      endToEnd: distribution(values.endToEnd),
      final: distribution(values.final),
      refinement: distribution(values.refinement),
      errors,
      fallbacks,
      missingTimestamps,
      retainedSamples: this.samples.size
    };
  }
}
