import { readFile } from "node:fs/promises";
import {
  ProviderLatencyReferenceRunner,
  type ReferenceOperationalDiagnostics
} from "../src/verification/realtimeLatencyReport";
import type { ProviderLatencySample } from "../src/realtime/latency";

interface ReferenceInput {
  warmupSamples?: number;
  samples: ProviderLatencySample[];
  catchUp: Array<{
    atMs: number;
    activeLag: number;
    pressureActive: boolean;
    catchUpState: "healthy" | "catching-up";
  }>;
  operations?: ReferenceOperationalDiagnostics;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: npm run verify:latency-reference -- <reference-samples.json>");
  }

  const input = JSON.parse(await readFile(inputPath, "utf8")) as ReferenceInput;
  const runner = new ProviderLatencyReferenceRunner(input.warmupSamples ?? 5);
  input.samples.forEach((sample) => runner.recordSample(sample));
  input.catchUp.forEach((observation) => runner.recordCatchUp(observation));
  const report = runner.report(input.operations);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
