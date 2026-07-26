import assert from "node:assert/strict";
import { selectAudioEvidenceChunk } from "../electron/providerSession";
import {
  calculateRealtimeLatencies,
  percentile,
  SessionLatencyAggregator
} from "../src/realtime/latency";

const timing = {
  audioEvidenceEndAtMs: 1000,
  asrReceivedAtMs: 1120,
  translationEligibleAtMs: 1150,
  translationRequestedAtMs: 1170,
  firstDraftReceivedAtMs: 1410,
  firstDraftVisibleAtMs: 1450,
  finalVisibleAtMs: 1700,
  refinementVisibleAtMs: 2100
};

assert.deepEqual(calculateRealtimeLatencies(timing), {
  fastDraftMs: 300,
  endToEndMs: 450,
  finalMs: 550,
  refinementMs: 650
});
assert.equal(
  calculateRealtimeLatencies({
    translationEligibleAtMs: 2000,
    firstDraftVisibleAtMs: 1999
  }).fastDraftMs,
  null
);
assert.equal(percentile([50, 10, 40, 20, 30], 0.5), 30);
assert.equal(percentile([50, 10, 40, 20, 30], 0.95), 50);
assert.equal(percentile([], 0.95), null);

const aggregator = new SessionLatencyAggregator(4);
aggregator.record({
  id: "provider-1",
  providerBacked: true,
  fallback: false,
  error: null,
  ...timing
});
aggregator.record({
  id: "fallback",
  providerBacked: true,
  fallback: true,
  error: "provider unavailable",
  ...timing,
  firstDraftVisibleAtMs: 4000
});
aggregator.record({
  id: "missing",
  providerBacked: true,
  fallback: false,
  error: null,
  translationEligibleAtMs: 1200,
  firstDraftVisibleAtMs: 1500
});

let snapshot = aggregator.snapshot();
assert.equal(snapshot.fastDraft.count, 2);
assert.equal(snapshot.fastDraft.mean, 300);
assert.equal(snapshot.endToEnd.count, 1);
assert.equal(snapshot.endToEnd.mean, 450);
assert.equal(snapshot.errors, 1);
assert.equal(snapshot.fallbacks, 1);
assert.equal(snapshot.missingTimestamps.endToEnd, 1);

aggregator.record({
  id: "provider-1",
  providerBacked: true,
  fallback: false,
  error: null,
  ...timing,
  audioEvidenceEndAtMs: 1200,
  translationEligibleAtMs: 1300,
  firstDraftVisibleAtMs: 1900,
  finalVisibleAtMs: 1800,
  refinementVisibleAtMs: 2200
});

const immutable = aggregator.getSample("provider-1");
assert.equal(immutable?.audioEvidenceEndAtMs, 1000);
assert.equal(immutable?.translationEligibleAtMs, 1150);
assert.equal(immutable?.firstDraftVisibleAtMs, 1450);
assert.equal(immutable?.finalVisibleAtMs, 1800);
assert.equal(immutable?.refinementVisibleAtMs, 2200);

const chunks = [0, 1, 2].map((sequence) => ({
  id: `chunk-${sequence}`,
  sourceType: "system" as const,
  sequence,
  timestampMs: sequence * 240,
  capturedAtMs: 10_000 + sequence * 240,
  durationMs: 240,
  volume: 0.5,
  queue: {
    depth: 0,
    maxDepth: 12,
    dropped: 0,
    lastSequence: sequence,
    lastPayloadBytes: 7680
  },
  payload: {
    encoding: "pcm16-base64" as const,
    sampleFormat: "s16le" as const,
    sampleRate: 16000,
    channels: 1,
    frameCount: 3840,
    byteLength: 7680,
    durationMs: 240,
    data: ""
  }
}));

assert.equal(selectAudioEvidenceChunk(chunks, 300)?.id, "chunk-1");
assert.equal(selectAudioEvidenceChunk(chunks, 700)?.id, "chunk-2");
assert.equal(selectAudioEvidenceChunk([], 300), null);

snapshot = aggregator.snapshot();
assert.equal(snapshot.fastDraft.count, 2);
assert.equal(snapshot.fastDraft.p50, 300);

console.log("realtime latency checks passed");
