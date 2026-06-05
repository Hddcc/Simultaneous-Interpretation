## ADDED Requirements

### Requirement: Use versioned subtitle segments
The system MUST represent each subtitle as a versioned segment with a stable segment identifier, source text, translated text, status, revision number, and timestamps.

#### Scenario: New subtitle segment created
- **WHEN** the pipeline emits the first subtitle content for an utterance
- **THEN** the UI stores and renders the subtitle with a stable segment identifier and revision number

### Requirement: Revise recent subtitles in place
The system SHALL update an existing subtitle segment in place when ASR or translation output is corrected for that segment.

#### Scenario: ASR correction changes meaning
- **WHEN** a later ASR event corrects the source text for a recent segment
- **THEN** the system updates the existing segment and increments its revision number

#### Scenario: Translation correction improves wording
- **WHEN** a later translation event improves the translated text for a recent segment
- **THEN** the system updates the existing segment and increments its revision number

### Requirement: Indicate revised content
The system SHALL provide a subtle UI indication when a visible subtitle has been revised.

#### Scenario: Visible subtitle revised
- **WHEN** a currently visible subtitle segment receives a newer revision
- **THEN** the UI indicates that the subtitle was updated without disrupting the reading flow

### Requirement: Limit revision window
The system MUST only revise recent subtitle segments within a configurable revision window.

#### Scenario: Old segment receives late correction
- **WHEN** a correction arrives for a segment outside the revision window
- **THEN** the system preserves the existing visible subtitle and records the late correction in session history if supported
