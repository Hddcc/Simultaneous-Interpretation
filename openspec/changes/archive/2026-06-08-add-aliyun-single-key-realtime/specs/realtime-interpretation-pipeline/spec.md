## MODIFIED Requirements

### Requirement: Stream audio to ASR
The system SHALL send normalized audio chunks with real audio payloads to an ASR service in streaming mode and receive partial and final recognition events, including Aliyun `fun-asr-realtime` when selected.

#### Scenario: Partial recognition arrives
- **WHEN** the ASR service emits a partial recognition event
- **THEN** the system publishes an interim source-text update for the current segment

#### Scenario: Final recognition arrives
- **WHEN** the ASR service emits a final recognition event
- **THEN** the system marks the source-text segment as final unless a later revision supersedes it

#### Scenario: Live system audio is active
- **WHEN** system playback audio is streaming in provider mode
- **THEN** ASR receives live audio chunks without requiring the user to upload a file

#### Scenario: Aliyun one-key realtime pipeline is active
- **WHEN** live audio is streaming with `REALTIME_ASR_PROVIDER=aliyun` and `TRANSLATION_PROVIDER=aliyun`
- **THEN** the pipeline uses `fun-asr-realtime` for speech recognition and a Qwen text model for translation using `DASHSCOPE_API_KEY`

### Requirement: Translate recognized text
The system SHALL translate finalized or sufficiently stable source text between English and Chinese according to the active language direction using the configured translation provider.

#### Scenario: English source translated to Chinese
- **WHEN** the active language direction is English to Chinese and recognized English text becomes stable
- **THEN** the system emits a Chinese translation for the same segment

#### Scenario: Chinese source translated to English
- **WHEN** the active language direction is Chinese to English and recognized Chinese text becomes stable
- **THEN** the system emits an English translation for the same segment

#### Scenario: Translation provider is unavailable
- **WHEN** stable ASR text is available but translation provider requests fail
- **THEN** the system keeps source text visible and shows a recoverable translation error

#### Scenario: Qwen translation is used
- **WHEN** `TRANSLATION_PROVIDER=aliyun` and a final ASR segment is ready
- **THEN** the system translates the segment with the configured Qwen model and records provider/model metadata on the subtitle
