import assert from "node:assert/strict";
import type { AudioSessionState } from "../src/audio/types";
import { createLiveExperienceState } from "../src/liveExperience/state";

const queue = {
  maxDepth: 12,
  depth: 0,
  dropped: 0,
  lastSequence: null,
  lastPayloadBytes: 0
};

const baseSession: AudioSessionState = {
  sourceType: "system",
  status: "idle",
  selectedFile: null,
  lastChunk: null,
  chunksProduced: 0,
  volume: 0,
  queue,
  error: null
};

function providerHealth(state: ProviderConnectionState, dropped = 0): ProviderHealth {
  return {
    config: {
      asrProvider: "openai",
      asrModel: "gpt-4o-mini-transcribe",
      asrBaseUrl: "https://api.openai.com/v1",
      translationProvider: "openai",
      translationModel: "gpt-4.1-mini",
      translationBaseUrl: "https://api.openai.com/v1",
      hasOpenAiKey: true,
      hasDeepSeekKey: false,
      hasDashScopeKey: false,
      realtimeEnabled: true,
      canStartRealtime: true,
      missing: [],
      secretsInRenderer: false,
      loadedAtMs: 1
    },
    session: {
      state,
      sessionId: state === "idle" ? null : "session-1",
      sourceType: "system",
      languagePairId: "en-US_to_zh-CN",
      asrProvider: "openai",
      translationProvider: "openai",
      queue: {
        ...queue,
        depth: dropped > 0 ? 9 : 0,
        dropped
      },
      recentLatencyMs: null,
      error: state === "error" ? "provider failed" : null,
      startedAtMs: 1,
      updatedAtMs: 2
    }
  };
}

assert.equal(
  createLiveExperienceState({
    session: { ...baseSession, status: "streaming" },
    providerHealth: providerHealth("connecting"),
    nativeAudioCapability: null
  }).phase,
  "connecting"
);

assert.equal(
  createLiveExperienceState({
    session: { ...baseSession, status: "streaming" },
    providerHealth: providerHealth("streaming"),
    nativeAudioCapability: null
  }).phase,
  "streaming"
);

assert.equal(
  createLiveExperienceState({
    session: { ...baseSession, status: "streaming" },
    providerHealth: providerHealth("reconnecting"),
    nativeAudioCapability: null
  }).phase,
  "reconnecting"
);

assert.equal(
  createLiveExperienceState({
    session: { ...baseSession, status: "streaming" },
    providerHealth: providerHealth("streaming", 1),
    nativeAudioCapability: null
  }).phase,
  "degraded"
);

const errorState = createLiveExperienceState({
  session: { ...baseSession, status: "error", error: "capture failed" },
  providerHealth: providerHealth("streaming"),
  nativeAudioCapability: null
});

assert.equal(errorState.phase, "error");
assert.equal(errorState.canRetry, true);
assert.equal(errorState.canUseFallback, true);

assert.equal(
  createLiveExperienceState({
    session: { ...baseSession, status: "stopped" },
    providerHealth: providerHealth("closed"),
    nativeAudioCapability: null
  }).phase,
  "stopped"
);

console.log("live experience state checks passed");
