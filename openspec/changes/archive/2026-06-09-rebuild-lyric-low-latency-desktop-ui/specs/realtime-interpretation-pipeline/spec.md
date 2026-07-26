## MODIFIED Requirements

### Requirement: Translate recognized text
The system SHALL translate finalized or sufficiently stable partial source text between English and Chinese according to the active language direction using the configured translation provider.

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
The system SHALL measure and display interpretation latency from audio capture time to ASR output, translation output, and visible subtitle cue update time.

#### Scenario: Subtitle event emitted
- **WHEN** a translated subtitle event is emitted
- **THEN** the UI can display the current ASR latency, translation latency, total latency, and visible cue update latency for that event or session

#### Scenario: Latency exceeds target
- **WHEN** current visible cue latency exceeds the configured warning threshold
- **THEN** the system records a diagnostic warning without blocking the active subtitle display

## ADDED Requirements

### Requirement: Schedule low-latency translation jobs
The system SHALL schedule translation jobs through a bounded low-latency queue that prefers the latest active cue.

#### Scenario: New stable partial supersedes queued job
- **WHEN** a newer revision of the same segment becomes translation-eligible before the previous translation finishes
- **THEN** the system marks the older translation result as stale and applies only the latest valid revision

#### Scenario: Multiple segments compete
- **WHEN** multiple partial or final segments are waiting for translation
- **THEN** the system prioritizes the current active cue over older history cues

### Requirement: Deduplicate translation requests
The system MUST avoid repeated translation requests for the same segment revision and language pair.

#### Scenario: Same revision arrives twice
- **WHEN** the pipeline receives duplicate ASR events for the same segment revision and text
- **THEN** the system reuses an existing queued, in-flight, or cached translation result

### Requirement: Drop stale realtime outputs
The system SHALL drop stale ASR or translation outputs that no longer match the current segment revision when applying visible subtitles.

#### Scenario: Old translation returns late
- **WHEN** a translation response returns for a source revision that has already been superseded
- **THEN** the system ignores it for the active cue and may record it only in diagnostics
