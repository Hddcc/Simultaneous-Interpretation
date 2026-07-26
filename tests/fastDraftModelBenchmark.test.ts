import assert from "node:assert/strict";
import {
  evaluateTranslationQuality,
  selectFastDraftDefault,
  summarizeLatencies
} from "../src/verification/fastDraftModelBenchmark";

const quality = evaluateTranslationQuality({
  sourceText: "The Qwen API latency target is 500 milliseconds.",
  translatedText: "Qwen API 的延迟目标是 500 毫秒。",
  preserveLiterals: ["Qwen", "API", "500"],
  qualityRules: [
    { sourceIncludes: "latency", targetAny: ["延迟", "时延"] },
    { sourceIncludes: "milliseconds", targetAny: ["毫秒"] }
  ]
});
assert.equal(quality.passed, true);

const missingLiteral = evaluateTranslationQuality({
  sourceText: "The P95 target is 900 milliseconds.",
  translatedText: "长尾目标为九百毫秒。",
  preserveLiterals: ["P95", "900"],
  qualityRules: []
});
assert.equal(missingLiteral.passed, false);
assert.deepEqual(missingLiteral.failures, ["missing-literal:P95", "missing-literal:900"]);

assert.deepEqual(summarizeLatencies([100, 200, 300, 400, 500]), {
  count: 5,
  mean: 300,
  p50: 300,
  p95: 500,
  max: 500
});

const selection = selectFastDraftDefault(
  [
    {
      model: "quality-model",
      attempted: 50,
      successful: 50,
      errors: 0,
      qualityPassRate: 1,
      latency: { count: 50, mean: 480, p50: 450, p95: 850, max: 880 }
    },
    {
      model: "faster-low-quality-model",
      attempted: 50,
      successful: 50,
      errors: 0,
      qualityPassRate: 0.8,
      latency: { count: 50, mean: 300, p50: 280, p95: 600, max: 650 }
    }
  ],
  { minimumSamples: 50, meanMs: 500, p95Ms: 900, minimumQualityPassRate: 0.98 }
);
assert.equal(selection.model, "quality-model");

console.log("fast draft model benchmark checks passed");
