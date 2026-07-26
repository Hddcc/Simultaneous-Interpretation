## MODIFIED Requirements

### Requirement: Stream audio to ASR
The system SHALL send normalized audio chunks with real audio payloads to an ASR service in streaming mode, using a configurable low-latency chunk cadence, and receive partial and final recognition events, including Aliyun `fun-asr-realtime` when selected.

#### Scenario: Partial recognition arrives
- **WHEN** the ASR service emits a partial recognition event
- **THEN** the system publishes an interim source-text update for the current segment

#### Scenario: Final recognition arrives
- **WHEN** the ASR service emits a final recognition event
- **THEN** the system marks the source-text segment as final unless a later revision supersedes it

#### Scenario: Live system audio is active
- **WHEN** system playback audio is streaming in provider mode
- **THEN** ASR receives live audio chunks without requiring the user to upload a file

#### Scenario: Low-latency chunk cadence configured
- **WHEN** realtime provider mode is active
- **THEN** the system uses the configured chunk duration and records capture cadence diagnostics

#### Scenario: Aliyun one-key realtime pipeline is active
- **WHEN** live audio is streaming with `REALTIME_ASR_PROVIDER=aliyun` and `TRANSLATION_PROVIDER=aliyun`
- **THEN** the pipeline uses `fun-asr-realtime` for speech recognition and a Qwen text model for translation using `DASHSCOPE_API_KEY`

### Requirement: Translate recognized text
The system SHALL translate finalized or sufficiently stable partial source text between English and Chinese according to the active language direction using the configured translation provider, while allowing later refinement revisions to improve naturalness.

#### Scenario: English source translated to Chinese
- **WHEN** the active language direction is English to Chinese and recognized English text becomes stable
- **THEN** the system emits a Chinese translation for the same segment

#### Scenario: Chinese source translated to English
- **WHEN** the active language direction is Chinese to English and recognized Chinese text becomes stable
- **THEN** the system emits an English translation for the same segment

#### Scenario: Stable partial text is available
- **WHEN** partial ASR text satisfies the configured stability threshold before a final ASR event arrives
- **THEN** the system may emit a draft translation for the current segment and mark it as revision-capable

#### Scenario: Final text corrects draft translation
- **WHEN** a final ASR event supersedes a translated partial segment
- **THEN** the system requests or applies an updated translation and revises the same visible segment or cue

#### Scenario: Translation provider is unavailable
- **WHEN** stable ASR text is available but translation provider requests fail
- **THEN** the system keeps source text visible and shows a recoverable translation error

#### Scenario: Qwen translation is used
- **WHEN** `TRANSLATION_PROVIDER=aliyun` and a stable ASR segment is ready
- **THEN** the system translates the segment with the configured Qwen model and records provider/model metadata on the subtitle

### Requirement: Expose pipeline latency
The system SHALL measure and display interpretation latency from audio capture time to ASR output, translation output, refinement output, and visible subtitle cue update time.

#### Scenario: Subtitle event emitted
- **WHEN** a translated or refined subtitle event is emitted
- **THEN** the UI can display the current ASR latency, translation latency, refinement latency, total latency, and visible cue update latency for that event or session

#### Scenario: Latency exceeds target
- **WHEN** current visible cue latency or refinement latency exceeds the configured warning threshold
- **THEN** the system records a diagnostic warning without blocking the active subtitle display

## ADDED Requirements

### Requirement: Configure realtime latency thresholds
The system SHALL expose runtime or code-level configuration for audio chunk duration, ASR event cadence, stable partial thresholds, and refinement eligibility.

#### Scenario: User or developer tunes latency
- **WHEN** latency thresholds are changed in configuration
- **THEN** the realtime pipeline uses the new values without requiring core pipeline rewrites

#### Scenario: Thresholds are too aggressive
- **WHEN** queue pressure, dropped chunks, or stale outputs increase after threshold changes
- **THEN** diagnostics expose enough detail to identify the bottleneck
