import type { AudioChunkQueueState, NormalizedAudioChunk } from "./types";

export class OrderedAudioPayloadQueue {
  private readonly pending: NormalizedAudioChunk[] = [];
  private inFlight: NormalizedAudioChunk | null = null;
  private dropped = 0;
  private lastSequence: number | null = null;
  private lastPayloadBytes = 0;

  constructor(private readonly maxDepth: number) {}

  enqueue(chunk: NormalizedAudioChunk): AudioChunkQueueState {
    this.lastSequence = chunk.sequence;
    this.lastPayloadBytes = chunk.payloadMetadata.byteLength;

    const waitingCapacity = Math.max(0, this.maxDepth - Number(Boolean(this.inFlight)));
    this.pending.push(chunk);
    const overflow = Math.max(0, this.pending.length - waitingCapacity);
    if (overflow > 0) {
      this.pending.splice(0, overflow);
      this.dropped += overflow;
    }

    return this.snapshot();
  }

  take(): NormalizedAudioChunk | null {
    if (this.inFlight) {
      return null;
    }
    this.inFlight = this.pending.shift() ?? null;
    return this.inFlight;
  }

  complete(chunkId: string): AudioChunkQueueState {
    if (this.inFlight?.id === chunkId) {
      this.inFlight = null;
    }
    return this.snapshot();
  }

  reset(preserveDropped = false): AudioChunkQueueState {
    this.pending.splice(0);
    this.inFlight = null;
    if (!preserveDropped) {
      this.dropped = 0;
    }
    this.lastSequence = null;
    this.lastPayloadBytes = 0;
    return this.snapshot();
  }

  snapshot(): AudioChunkQueueState {
    return {
      maxDepth: this.maxDepth,
      depth: this.pending.length + Number(Boolean(this.inFlight)),
      dropped: this.dropped,
      lastSequence: this.lastSequence,
      lastPayloadBytes: this.lastPayloadBytes
    };
  }
}
