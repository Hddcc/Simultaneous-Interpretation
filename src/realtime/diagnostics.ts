import type { AudioChunkQueueState } from "../audio/types";
import type { SessionLatencySnapshot } from "./latency";
import type { RefinementSchedulerDiagnostics } from "../translation/refinementScheduler";
import type { TranslationSchedulerDiagnostics } from "../translation/scheduler";

export interface RealtimeDiagnosticsSnapshot {
  capturedAtMs: number;
  latency: SessionLatencySnapshot;
  translation: TranslationSchedulerDiagnostics;
  refinement: RefinementSchedulerDiagnostics;
  provider: {
    queueDepth: number;
    queueMaxDepth: number;
    queueRatio: number;
    correlatedAsrEvents: number;
    uncorrelatedAsrEvents: number;
  };
}

export function createRealtimeDiagnosticsSnapshot(input: {
  latency: SessionLatencySnapshot;
  translation: TranslationSchedulerDiagnostics;
  refinement: RefinementSchedulerDiagnostics;
  providerQueue?: Pick<AudioChunkQueueState, "depth" | "maxDepth"> | null;
  providerTiming?: { correlatedEvents: number; uncorrelatedEvents: number } | null;
  nowMs?: number;
}): RealtimeDiagnosticsSnapshot {
  const depth = input.providerQueue?.depth ?? 0;
  const maxDepth = input.providerQueue?.maxDepth ?? 0;
  return {
    capturedAtMs: input.nowMs ?? Date.now(),
    latency: input.latency,
    translation: input.translation,
    refinement: input.refinement,
    provider: {
      queueDepth: depth,
      queueMaxDepth: maxDepth,
      queueRatio: maxDepth > 0 ? depth / maxDepth : 0,
      correlatedAsrEvents: input.providerTiming?.correlatedEvents ?? 0,
      uncorrelatedAsrEvents: input.providerTiming?.uncorrelatedEvents ?? 0
    }
  };
}
