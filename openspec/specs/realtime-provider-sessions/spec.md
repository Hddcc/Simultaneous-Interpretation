# realtime-provider-sessions Specification

## Purpose
Define secure realtime ASR and translation provider session behavior, including runtime configuration, audio streaming lifecycle, partial/final recognition events, provider health, queue state, and translation provider selection.
## Requirements
### Requirement: Manage realtime ASR sessions
The system SHALL open, stream to, and close a provider-backed realtime ASR session for live system audio and microphone audio, including OpenAI realtime ASR and Aliyun DashScope `fun-asr-realtime`.

#### Scenario: Session starts successfully
- **WHEN** the user starts a live interpretation session with a valid provider configuration
- **THEN** the system connects to the ASR provider and begins sending audio chunks

#### Scenario: Aliyun realtime ASR session starts
- **WHEN** `REALTIME_ASR_PROVIDER=aliyun`, `REALTIME_ASR_MODEL=fun-asr-realtime`, and `DASHSCOPE_API_KEY` is configured
- **THEN** the system connects to DashScope realtime inference and begins sending live audio chunks without requiring OpenAI credentials

#### Scenario: Partial ASR result arrives
- **WHEN** the provider sends a partial recognition result
- **THEN** the system emits a partial source-text event linked to the active segment

#### Scenario: Final ASR result arrives
- **WHEN** the provider sends a final recognition result
- **THEN** the system emits a final source-text event and makes it eligible for translation

### Requirement: Manage provider configuration securely
The system MUST load provider keys and model configuration from local runtime configuration without exposing secrets in the renderer bundle or repository.

#### Scenario: API key is missing
- **WHEN** a provider-backed session is requested without a required API key
- **THEN** the system refuses to start the provider session and displays a local configuration message

#### Scenario: Aliyun single key is configured
- **WHEN** `DASHSCOPE_API_KEY` is present and both ASR and translation providers are set to `aliyun`
- **THEN** the system reports provider configuration as startable without requiring `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, or `CUSTOM_TRANSLATION_API_KEY`

#### Scenario: Aliyun key is missing
- **WHEN** `REALTIME_ASR_PROVIDER=aliyun` or `TRANSLATION_PROVIDER=aliyun` is configured without `DASHSCOPE_API_KEY`
- **THEN** the system reports `DASHSCOPE_API_KEY` as the missing local configuration item

### Requirement: Report provider health and queue state
The system SHALL expose provider connection state, queue depth, recent latency, and recoverable errors to the workbench.

#### Scenario: Provider latency increases
- **WHEN** audio chunks are queued faster than provider responses arrive
- **THEN** the UI shows degraded status and the system keeps queue memory bounded

#### Scenario: Aliyun provider reports an error
- **WHEN** the DashScope WebSocket closes unexpectedly or returns an error event
- **THEN** the workbench shows a recoverable Aliyun provider error and keeps stop, retry, and fallback controls available

### Requirement: Support translation provider selection
The system SHALL allow recognized text to be translated by a configured text provider, including OpenAI, DeepSeek-compatible models, custom-compatible models, and Aliyun Qwen models through DashScope.

#### Scenario: DeepSeek translation provider is selected
- **WHEN** ASR final text is available and DeepSeek-compatible translation is configured
- **THEN** the system sends text and recent context to the translation provider and emits translated subtitles

#### Scenario: Aliyun Qwen translation provider is selected
- **WHEN** ASR final text is available, `TRANSLATION_PROVIDER=aliyun`, and `DASHSCOPE_API_KEY` is configured
- **THEN** the system sends text and recent context to Qwen and emits translated subtitles without requiring a second translation key
