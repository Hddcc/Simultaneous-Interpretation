## MODIFIED Requirements

### Requirement: Revise recent subtitles in place
The system SHALL update an existing subtitle segment in place when realtime ASR partial/final output or translation output is corrected for that segment.

#### Scenario: ASR correction changes meaning
- **WHEN** a later ASR event corrects the source text for a recent segment
- **THEN** the system updates the existing segment and increments its revision number

#### Scenario: Translation correction improves wording
- **WHEN** a later translation event improves the translated text for a recent segment
- **THEN** the system updates the existing segment and increments its revision number

#### Scenario: Provider finalizes a partial segment
- **WHEN** a realtime provider final event supersedes partial text for the same segment
- **THEN** the visible subtitle is updated in place and marked as finalized or revised

## ADDED Requirements

### Requirement: Preserve revision provenance
The system MUST record whether a revision came from ASR partial correction, ASR finalization, translation correction, provider reconnect, or manual fallback.

#### Scenario: Subtitle is revised
- **WHEN** a subtitle segment receives a newer revision
- **THEN** session history records the revision source and revision number
