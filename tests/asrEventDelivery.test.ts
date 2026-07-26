import assert from "node:assert/strict";
import {
  bufferRealtimeProviderAsrEvent,
  pullRealtimeProviderAsrEvents,
  subscribeRealtimeProviderAsrEvents,
  type RealtimeProviderAsrEvent
} from "../electron/providerSession";
import { RealtimeAsrEventDeduplicator } from "../src/asr/eventDeduplication";

function event(id: string, revision: number): RealtimeProviderAsrEvent {
  return {
    id,
    segmentId: "segment-1",
    chunkId: `chunk-${revision}`,
    sourceType: "system",
    sequence: revision,
    audioStartMs: 0,
    audioEndMs: revision * 240,
    text: revision === 1 ? "hello" : "hello world",
    status: revision === 1 ? "partial" : "final",
    revision,
    receivedAtMs: 10_000 + revision * 300,
    audioEvidenceEndAtMs: 10_000 + revision * 240,
    asrReceivedAtMs: 10_000 + revision * 300,
    timingCorrelation: "provider-offset",
    latencyMs: 60,
    provider: "aliyun",
    model: "fun-asr-realtime"
  };
}

pullRealtimeProviderAsrEvents();
const pushed: RealtimeProviderAsrEvent[] = [];
const unsubscribe = subscribeRealtimeProviderAsrEvents((nextEvent) => pushed.push(nextEvent));
const partial = event("event-1", 1);
bufferRealtimeProviderAsrEvent(partial);

assert.deepEqual(pushed, [partial]);
assert.deepEqual(pullRealtimeProviderAsrEvents(), [partial]);
assert.deepEqual(pullRealtimeProviderAsrEvents(), []);

unsubscribe();
const final = event("event-2", 2);
bufferRealtimeProviderAsrEvent(final);
assert.deepEqual(pushed, [partial]);
assert.deepEqual(pullRealtimeProviderAsrEvents(), [final]);

const deduplicator = new RealtimeAsrEventDeduplicator(2);
assert.deepEqual(
  deduplicator.filter([partial, partial, final]).map((item) => item.id),
  ["event-1", "event-2"]
);
assert.deepEqual(deduplicator.filter([partial, final]), []);

const third = event("event-3", 3);
assert.deepEqual(deduplicator.filter([third]).map((item) => item.id), ["event-3"]);
assert.deepEqual(deduplicator.filter([partial]).map((item) => item.id), ["event-1"]);
assert.equal(final.audioEvidenceEndAtMs, 10_480);
assert.equal(final.asrReceivedAtMs, 10_600);
assert.equal(final.timingCorrelation, "provider-offset");

console.log("ASR event delivery checks passed");
