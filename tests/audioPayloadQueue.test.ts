import assert from "node:assert/strict";
import { OrderedAudioPayloadQueue } from "../src/audio/payloadQueue";
import type { NormalizedAudioChunk } from "../src/audio/types";

function chunk(sequence: number): NormalizedAudioChunk {
  return {
    id: `chunk-${sequence}`,
    sourceType: "system",
    sequence,
    timestampMs: sequence * 160,
    durationMs: 160,
    sampleRate: 16_000,
    channels: 1,
    volume: 0.5,
    status: "captured",
    payloadMetadata: {
      available: true,
      providerReady: true,
      encoding: "pcm16-base64",
      sampleFormat: "s16le",
      byteLength: 5_120,
      frameCount: 2_560,
      producedAtMs: sequence * 160
    }
  };
}

const longRunningQueue = new OrderedAudioPayloadQueue(12);
for (let sequence = 0; sequence < 10_000; sequence += 1) {
  longRunningQueue.enqueue(chunk(sequence));
  const next = longRunningQueue.take();
  assert.equal(next?.sequence, sequence);
  longRunningQueue.complete(next?.id ?? "");
}
assert.deepEqual(longRunningQueue.snapshot(), {
  maxDepth: 12,
  depth: 0,
  dropped: 0,
  lastSequence: 9_999,
  lastPayloadBytes: 5_120
});

const overloadedQueue = new OrderedAudioPayloadQueue(3);
overloadedQueue.enqueue(chunk(0));
assert.equal(overloadedQueue.take()?.sequence, 0);
for (let sequence = 1; sequence <= 5; sequence += 1) {
  overloadedQueue.enqueue(chunk(sequence));
}
assert.equal(overloadedQueue.snapshot().depth, 3);
assert.equal(overloadedQueue.snapshot().dropped, 3);
overloadedQueue.complete("chunk-0");
assert.equal(overloadedQueue.take()?.sequence, 4);
overloadedQueue.complete("chunk-4");
assert.equal(overloadedQueue.take()?.sequence, 5);

console.log("audio payload queue checks passed");
