## MODIFIED Requirements

### Requirement: Revise recent subtitles in place
The system SHALL update an existing subtitle segment or active lyric cue in place when realtime ASR partial/final output, translation output, or refinement output is corrected for that segment.

#### Scenario: ASR correction changes meaning
- **WHEN** a later ASR event corrects the source text for a recent segment
- **THEN** the system updates the existing segment or active cue and increments its revision number

#### Scenario: Translation correction improves wording
- **WHEN** a later translation event improves the translated text for a recent segment
- **THEN** the system updates the existing segment or active cue and increments its revision number

#### Scenario: Refinement improves naturalness
- **WHEN** a refinement result improves the source or translated text for a recent segment
- **THEN** the system updates the existing segment or active cue in place and increments or records its refinement revision

#### Scenario: Provider finalizes a partial segment
- **WHEN** a realtime provider final event supersedes partial text for the same segment
- **THEN** the visible subtitle or active cue is updated in place and marked as finalized or revised

#### Scenario: Lyric cue receives correction
- **WHEN** the active lyric cue receives a correction for the same segment identifier
- **THEN** the system revises the current cue instead of appending another visible lyric line

### Requirement: Indicate revised content
The system SHALL provide a subtle UI indication when a visible subtitle or lyric cue has been revised by ASR, translation, or refinement.

#### Scenario: Visible subtitle revised
- **WHEN** a currently visible subtitle segment receives a newer revision
- **THEN** the UI indicates that the subtitle was updated without disrupting the reading flow

#### Scenario: Active lyric cue revised
- **WHEN** the active lyric cue translation changes after a final ASR, translation correction, or refinement correction
- **THEN** the UI updates the cue in place with a subtle revised state or transition

### Requirement: Preserve revision provenance
The system MUST record whether a revision came from ASR partial correction, ASR finalization, translation correction, refinement correction, provider reconnect, or manual fallback.

#### Scenario: Subtitle is revised
- **WHEN** a subtitle segment receives a newer revision
- **THEN** session history records the revision source and revision number

#### Scenario: Refined subtitle is revised
- **WHEN** a refinement result updates a subtitle
- **THEN** session history and diagnostics record the refinement provider, model, latency, and revision provenance
