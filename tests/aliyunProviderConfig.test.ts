import assert from "node:assert/strict";
import {
  createAliyunRunTaskMessage,
  getProviderRuntimeConfig,
  mapAliyunRealtimeMessage
} from "../electron/providerSession";

const originalEnv = { ...process.env };

function resetEnv(values: NodeJS.ProcessEnv): void {
  process.env = { ...originalEnv, ...values };
}

resetEnv({
  REALTIME_ASR_PROVIDER: "aliyun",
  TRANSLATION_PROVIDER: "aliyun",
  DASHSCOPE_API_KEY: "test-dashscope-key"
});

const aliyunConfig = getProviderRuntimeConfig();
assert.equal(aliyunConfig.asrProvider, "aliyun");
assert.equal(aliyunConfig.asrModel, "fun-asr-realtime");
assert.equal(aliyunConfig.asrBaseUrl, "wss://dashscope.aliyuncs.com/api-ws/v1/inference");
assert.equal(aliyunConfig.translationProvider, "aliyun");
assert.equal(aliyunConfig.translationModel, "qwen-plus");
assert.equal(aliyunConfig.translationBaseUrl, "https://dashscope.aliyuncs.com/compatible-mode/v1");
assert.equal(aliyunConfig.hasDashScopeKey, true);
assert.equal(aliyunConfig.canStartRealtime, true);
assert.deepEqual(aliyunConfig.missing, []);

resetEnv({
  REALTIME_ASR_PROVIDER: "aliyun",
  TRANSLATION_PROVIDER: "aliyun",
  DASHSCOPE_API_KEY: ""
});

const missingConfig = getProviderRuntimeConfig();
assert.equal(missingConfig.canStartRealtime, false);
assert.deepEqual(missingConfig.missing, ["DASHSCOPE_API_KEY"]);

const runTask = createAliyunRunTaskMessage("task-1", "fun-asr-realtime", "en-US") as {
  header: { action: string; task_id: string; streaming: string };
  payload: {
    model: string;
    parameters: { format: string; sample_rate: number; language_hints?: string[] };
  };
};

assert.equal(runTask.header.action, "run-task");
assert.equal(runTask.header.task_id, "task-1");
assert.equal(runTask.header.streaming, "duplex");
assert.equal(runTask.payload.model, "fun-asr-realtime");
assert.equal(runTask.payload.parameters.format, "pcm");
assert.equal(runTask.payload.parameters.sample_rate, 16000);
assert.deepEqual(runTask.payload.parameters.language_hints, ["en"]);

assert.deepEqual(
  mapAliyunRealtimeMessage(
    JSON.stringify({
      header: { event: "task-started", task_id: "task-1" }
    })
  ),
  { event: "task-started" }
);

assert.deepEqual(
  mapAliyunRealtimeMessage(
    JSON.stringify({
      header: { event: "result-generated", task_id: "task-1" },
      payload: {
        output: {
          sentence: {
            sentence_id: 7,
            text: "hello world",
            sentence_end: false
          }
        }
      }
    })
  ),
  {
    event: "result-generated",
    segmentId: "aliyun-sentence-7",
    text: "hello world",
    status: "partial"
  }
);

assert.deepEqual(
  mapAliyunRealtimeMessage(
    JSON.stringify({
      header: { event: "result-generated", task_id: "task-1" },
      payload: {
        output: {
          sentence: {
            sentence_id: 7,
            text: "hello world",
            sentence_end: true
          }
        }
      }
    })
  )?.status,
  "final"
);

assert.equal(
  mapAliyunRealtimeMessage(
    JSON.stringify({
      header: { event: "task-failed", error_message: "quota exceeded" }
    })
  )?.error,
  "quota exceeded"
);

process.env = originalEnv;

console.log("aliyun provider config checks passed");
