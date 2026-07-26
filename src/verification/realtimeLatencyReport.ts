import {
  SessionLatencyAggregator,
  type ProviderLatencySample,
  type SessionLatencySnapshot
} from "../realtime/latency";

export const REFERENCE_LATENCY_SLO = {
  minimumWarmedSamples: 50,
  fastDraftMeanMs: 500,
  fastDraftP95Ms: 900,
  endToEndP50Ms: 800,
  endToEndP95Ms: 1500,
  maximumActiveLag: 1,
  maximumRecoveryMs: 2000
} as const;

export interface ReferenceOperationalDiagnostics {
  requestCount: number;
  supersededPartials: number;
  cancellationAttempts: number;
  cancellationSucceeded: number;
  cancellationIgnored: number;
}

export interface ReferenceLatencyReport {
  generatedAtMs: number;
  warmupSamples: number;
  attemptedSamples: number;
  latency: SessionLatencySnapshot;
  maximumActiveLag: number;
  recoveryMs: number | null;
  operations: ReferenceOperationalDiagnostics;
  checks: {
    sampleCount: boolean;
    fastDraftMean: boolean;
    fastDraftP95: boolean;
    endToEndP50: boolean;
    endToEndP95: boolean;
    activeLag: boolean;
    recovery: boolean;
  };
  passed: boolean;
}

const emptyOperations: ReferenceOperationalDiagnostics = {
  requestCount: 0,
  supersededPartials: 0,
  cancellationAttempts: 0,
  cancellationSucceeded: 0,
  cancellationIgnored: 0
};

export class ProviderLatencyReferenceRunner {
  private readonly aggregator = new SessionLatencyAggregator(512);
  private readonly warmupIds = new Set<string>();
  private readonly attemptedIds = new Set<string>();
  private maximumActiveLag = 0;
  private pressureWasActive = false;
  private pressureClearedAtMs: number | null = null;
  private recoveryMs: number | null = null;

  constructor(private readonly warmupSamples = 5) {}

  reset(): void {
    this.aggregator.reset();
    this.warmupIds.clear();
    this.attemptedIds.clear();
    this.maximumActiveLag = 0;
    this.pressureWasActive = false;
    this.pressureClearedAtMs = null;
    this.recoveryMs = null;
  }

  recordSample(sample: ProviderLatencySample): void {
    if (!sample.providerBacked) {
      return;
    }
    if (!this.warmupIds.has(sample.id) && this.warmupIds.size < this.warmupSamples) {
      this.warmupIds.add(sample.id);
      return;
    }
    if (this.warmupIds.has(sample.id)) {
      return;
    }
    this.attemptedIds.add(sample.id);
    this.aggregator.record(sample);
  }

  recordCatchUp(input: {
    atMs: number;
    activeLag: number;
    pressureActive: boolean;
    catchUpState: "healthy" | "catching-up";
  }): void {
    this.maximumActiveLag = Math.max(this.maximumActiveLag, input.activeLag);
    if (input.pressureActive) {
      this.pressureWasActive = true;
      this.pressureClearedAtMs = null;
      return;
    }
    if (this.pressureWasActive && this.pressureClearedAtMs === null) {
      this.pressureClearedAtMs = input.atMs;
    }
    if (
      this.pressureClearedAtMs !== null &&
      input.catchUpState === "healthy" &&
      this.recoveryMs === null
    ) {
      this.recoveryMs = Math.max(0, input.atMs - this.pressureClearedAtMs);
    }
  }

  report(
    operations: ReferenceOperationalDiagnostics = emptyOperations,
    nowMs = Date.now()
  ): ReferenceLatencyReport {
    const latency = this.aggregator.snapshot();
    const checks = {
      sampleCount: latency.fastDraft.count >= REFERENCE_LATENCY_SLO.minimumWarmedSamples,
      fastDraftMean:
        latency.fastDraft.mean !== null &&
        latency.fastDraft.mean <= REFERENCE_LATENCY_SLO.fastDraftMeanMs,
      fastDraftP95:
        latency.fastDraft.p95 !== null &&
        latency.fastDraft.p95 <= REFERENCE_LATENCY_SLO.fastDraftP95Ms,
      endToEndP50:
        latency.endToEnd.p50 !== null &&
        latency.endToEnd.p50 <= REFERENCE_LATENCY_SLO.endToEndP50Ms,
      endToEndP95:
        latency.endToEnd.p95 !== null &&
        latency.endToEnd.p95 <= REFERENCE_LATENCY_SLO.endToEndP95Ms,
      activeLag: this.maximumActiveLag <= REFERENCE_LATENCY_SLO.maximumActiveLag,
      recovery:
        this.recoveryMs !== null &&
        this.recoveryMs <= REFERENCE_LATENCY_SLO.maximumRecoveryMs
    };

    return {
      generatedAtMs: nowMs,
      warmupSamples: this.warmupIds.size,
      attemptedSamples: this.attemptedIds.size,
      latency,
      maximumActiveLag: this.maximumActiveLag,
      recoveryMs: this.recoveryMs,
      operations,
      checks,
      passed: Object.values(checks).every(Boolean)
    };
  }
}
