export interface BenchmarkQualityRule {
  sourceIncludes: string;
  targetAny: string[];
}

export interface TranslationQualityResult {
  passed: boolean;
  failures: string[];
}

export interface LatencyDistribution {
  count: number;
  mean: number | null;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export interface FastDraftCandidateSummary {
  model: string;
  attempted: number;
  successful: number;
  errors: number;
  qualityPassRate: number;
  latency: LatencyDistribution;
}

export interface FastDraftBenchmarkTargets {
  minimumSamples: number;
  meanMs: number;
  p95Ms: number;
  minimumQualityPassRate: number;
}

export interface FastDraftCandidateEvaluation {
  model: string;
  checks: {
    sampleCount: boolean;
    mean: boolean;
    p95: boolean;
    quality: boolean;
  };
  passedChecks: number;
  eligible: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsLiteral(text: string, literal: string): boolean {
  const escaped = escapeRegExp(literal);
  const needsBoundary = /^[A-Za-z0-9]+$/.test(literal);
  return new RegExp(needsBoundary ? `\\b${escaped}\\b` : escaped, "i").test(text);
}

export function evaluateTranslationQuality(input: {
  sourceText: string;
  translatedText: string;
  preserveLiterals: string[];
  qualityRules: BenchmarkQualityRule[];
}): TranslationQualityResult {
  const failures: string[] = [];
  const translated = input.translatedText.trim();

  if (!/[\u3400-\u9fff]/u.test(translated)) {
    failures.push("missing-chinese-text");
  }
  if (/```|^\s*(translation|translated text)\s*:/i.test(translated)) {
    failures.push("unexpected-wrapper");
  }

  input.preserveLiterals.forEach((literal) => {
    if (containsLiteral(input.sourceText, literal) && !containsLiteral(translated, literal)) {
      failures.push(`missing-literal:${literal}`);
    }
  });

  input.qualityRules.forEach((rule) => {
    if (
      input.sourceText.toLocaleLowerCase().includes(rule.sourceIncludes.toLocaleLowerCase()) &&
      !rule.targetAny.some((candidate) =>
        translated.toLocaleLowerCase().includes(candidate.toLocaleLowerCase())
      )
    ) {
      failures.push(`missing-concept:${rule.sourceIncludes}`);
    }
  });

  return { passed: failures.length === 0, failures };
}

function percentile(sorted: number[], ratio: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

export function summarizeLatencies(values: number[]): LatencyDistribution {
  if (values.length === 0) {
    return { count: 0, mean: null, p50: null, p95: null, max: null };
  }

  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: sorted.length,
    mean: Math.round((sorted.reduce((total, value) => total + value, 0) / sorted.length) * 10) / 10,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted[sorted.length - 1]
  };
}

export function evaluateCandidate(
  candidate: FastDraftCandidateSummary,
  targets: FastDraftBenchmarkTargets
): FastDraftCandidateEvaluation {
  const checks = {
    sampleCount: candidate.successful >= targets.minimumSamples,
    mean: candidate.latency.mean !== null && candidate.latency.mean <= targets.meanMs,
    p95: candidate.latency.p95 !== null && candidate.latency.p95 <= targets.p95Ms,
    quality: candidate.qualityPassRate >= targets.minimumQualityPassRate
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    model: candidate.model,
    checks,
    passedChecks,
    eligible: passedChecks === Object.keys(checks).length
  };
}

export function selectFastDraftDefault(
  candidates: FastDraftCandidateSummary[],
  targets: FastDraftBenchmarkTargets
): { model: string; evaluations: FastDraftCandidateEvaluation[] } {
  if (candidates.length === 0) {
    throw new Error("At least one fast-draft candidate is required.");
  }

  const evaluations = candidates.map((candidate) => evaluateCandidate(candidate, targets));
  const evaluationByModel = new Map(evaluations.map((evaluation) => [evaluation.model, evaluation]));
  const ranked = [...candidates].sort((left, right) => {
    const leftEvaluation = evaluationByModel.get(left.model)!;
    const rightEvaluation = evaluationByModel.get(right.model)!;
    if (leftEvaluation.eligible !== rightEvaluation.eligible) {
      return leftEvaluation.eligible ? -1 : 1;
    }
    if (leftEvaluation.passedChecks !== rightEvaluation.passedChecks) {
      return rightEvaluation.passedChecks - leftEvaluation.passedChecks;
    }
    if (left.qualityPassRate !== right.qualityPassRate) {
      return right.qualityPassRate - left.qualityPassRate;
    }
    const p95Difference = (left.latency.p95 ?? Number.POSITIVE_INFINITY) -
      (right.latency.p95 ?? Number.POSITIVE_INFINITY);
    if (p95Difference !== 0) {
      return p95Difference;
    }
    return (left.latency.mean ?? Number.POSITIVE_INFINITY) -
      (right.latency.mean ?? Number.POSITIVE_INFINITY);
  });

  return { model: ranked[0].model, evaluations };
}
