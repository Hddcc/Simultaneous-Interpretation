## MODIFIED Requirements

### Requirement: Revise recent subtitles in place
The system SHALL update an existing subtitle segment or active lyric cue in place when realtime ASR partial/final output or translation output is corrected for that segment.

#### Scenario: ASR correction changes meaning
- **WHEN** a later ASR event corrects the source text for a recent segment
- **THEN** the system updates the existing segment or active cue and increments its revision number

#### Scenario: Translation correction improves wording
- **WHEN** a later translation event improves the translated text for a recent segment
- **THEN** the system updates the existing segment or active cue and increments its revision number

#### Scenario: Provider finalizes a partial segment
- **WHEN** a realtime provider final event supersedes partial text for the same segment
- **THEN** the visible subtitle or active cue is updated in place and marked as finalized or revised

#### Scenario: Lyric cue receives correction
- **WHEN** the active lyric cue receives a correction for the same segment identifier
- **THEN** the system revises the current cue instead of appending another visible lyric line

### Requirement: Indicate revised content
The system SHALL provide a subtle UI indication when a visible subtitle or lyric cue has been revised.

#### Scenario: Visible subtitle revised
- **WHEN** a currently visible subtitle segment receives a newer revision
- **THEN** the UI indicates that the subtitle was updated without disrupting the reading flow

#### Scenario: Active lyric cue revised
- **WHEN** the active lyric cue translation changes after a final ASR or translation correction
- **THEN** the UI updates the cue in place with a subtle revised state or transition

### Requirement: Limit revision window
The system MUST only revise recent subtitle segments and lyric cues within a configurable revision window.

#### Scenario: Old segment receives late correction
- **WHEN** a correction arrives for a segment outside the revision window
- **THEN** the system preserves the existing visible subtitle and records the late correction in session history if supported

#### Scenario: Old lyric cue is no longer active
- **WHEN** a correction arrives for a cue that has moved outside the lyric revision window
- **THEN** the system does not interrupt the active cue and may update history with revision provenance
