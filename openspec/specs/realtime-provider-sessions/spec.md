# realtime-provider-sessions Specification

## Purpose
Define secure realtime ASR and translation provider session behavior, including runtime configuration, audio streaming lifecycle, partial/final recognition events, provider health, queue state, and translation provider selection.

## Requirements
### Requirement: Manage realtime ASR sessions
The system SHALL open, stream to, and close a provider-backed realtime ASR session for live system audio and microphone audio.

#### Scenario: Session starts successfully
- **WHEN** the user starts a live interpretation session with a valid provider configuration
- **THEN** the system connects to the ASR provider and begins sending audio chunks

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

### Requirement: Report provider health and queue state
The system SHALL expose provider connection state, queue depth, recent latency, and recoverable errors to the workbench.

#### Scenario: Provider latency increases
- **WHEN** audio chunks are queued faster than provider responses arrive
- **THEN** the UI shows degraded status and the system keeps queue memory bounded

### Requirement: Support translation provider selection
The system SHALL allow recognized text to be translated by a configured text provider, including OpenAI as the default path and DeepSeek-compatible models as an optional translation-only path.

#### Scenario: DeepSeek translation provider is selected
- **WHEN** ASR final text is available and DeepSeek-compatible translation is configured
- **THEN** the system sends text and recent context to the translation provider and emits translated subtitles
