## Purpose

Define the streaming interpretation pipeline from normalized audio chunks through ASR, translation, context handling, and latency reporting.
## Requirements
### Requirement: Stream audio to ASR
The system SHALL send normalized audio chunks with real audio payloads to an ASR service in streaming mode and receive partial and final recognition events.

#### Scenario: Partial recognition arrives
- **WHEN** the ASR service emits a partial recognition event
- **THEN** the system publishes an interim source-text update for the current segment

#### Scenario: Final recognition arrives
- **WHEN** the ASR service emits a final recognition event
- **THEN** the system marks the source-text segment as final unless a later revision supersedes it

#### Scenario: Live system audio is active
- **WHEN** system playback audio is streaming in provider mode
- **THEN** ASR receives live audio chunks without requiring the user to upload a file

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

### Requirement: Preserve recent context
The system MUST provide recent source and translated context to translation requests when context is available.

#### Scenario: Technical term continues across segments
- **WHEN** a new segment is translated after related recent segments
- **THEN** the translation request includes recent context so terminology and sentence continuity can remain consistent

### Requirement: Expose pipeline latency
The system SHALL measure and display interpretation latency from audio capture time to ASR output, translation output, and subtitle emission time.

#### Scenario: Subtitle event emitted
- **WHEN** a translated subtitle event is emitted
- **THEN** the UI can display the current ASR latency, translation latency, and total latency for that event or session
