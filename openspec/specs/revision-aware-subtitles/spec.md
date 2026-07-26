## Purpose

Define how subtitles are versioned, revised in place, visually indicated, and bounded by a recent revision window.
## Requirements
### Requirement: Use versioned subtitle segments
The system MUST represent each subtitle as a versioned segment with a stable segment identifier, source text, translated text, status, revision number, and timestamps.

#### Scenario: New subtitle segment created
- **WHEN** the pipeline emits the first subtitle content for an utterance
- **THEN** the UI stores and renders the subtitle with a stable segment identifier and revision number

### Requirement: Revise recent subtitles in place
The system SHALL update an existing subtitle segment or active lyric cue in place when realtime ASR partial/final output, translation output, refinement output, or history backfill output is corrected for that segment without rolling the active cue back to older speech.

#### Scenario: ASR correction changes meaning
- **WHEN** a later ASR event corrects the source text for a recent segment
- **THEN** the system updates the existing segment or cue and increments its revision number when that update is still eligible for visible revision

#### Scenario: Translation correction improves wording
- **WHEN** a later translation event improves the translated text for a recent segment
- **THEN** the system updates the existing segment or cue and increments its revision number when that update does not violate the active rollback guard

#### Scenario: Refinement improves naturalness
- **WHEN** a refinement result improves the source or translated text for a recent segment
- **THEN** the system updates the existing segment or cue in place and increments or records its refinement revision when refinement is still eligible

#### Scenario: Provider finalizes a partial segment
- **WHEN** a realtime provider final event supersedes partial text for the same segment
- **THEN** the segment is marked as finalized and either revises the visible cue or updates history without interrupting a newer active cue

#### Scenario: Lyric cue receives correction
- **WHEN** the active lyric cue receives a correction for the same segment identifier
- **THEN** the system revises the current cue instead of appending another visible lyric line

#### Scenario: Backfill updates history
- **WHEN** a late final ASR or final translation result completes an older segment
- **THEN** the system updates the matching history segment and records that the update came from history backfill

### Requirement: Indicate revised content
The system SHALL provide a subtle UI indication when a visible subtitle or lyric cue has been revised by ASR, translation, or refinement.

#### Scenario: Visible subtitle revised
- **WHEN** a currently visible subtitle segment receives a newer revision
- **THEN** the UI indicates that the subtitle was updated without disrupting the reading flow

#### Scenario: Active lyric cue revised
- **WHEN** the active lyric cue translation changes after a final ASR, translation correction, or refinement correction
- **THEN** the UI updates the cue in place with a subtle revised state or transition

### Requirement: Limit revision window
The system MUST only revise recent subtitle segments and lyric cues within a configurable revision window and MUST route older eligible final results to history backfill instead of active subtitle rollback.

#### Scenario: Old segment receives late correction
- **WHEN** a correction arrives for a segment outside the revision window
- **THEN** the system preserves the existing visible subtitle and records the late correction in session history if supported

#### Scenario: Old lyric cue is no longer active
- **WHEN** a correction arrives for a cue that has moved outside the lyric revision window
- **THEN** the system does not interrupt the active cue and may update history with revision provenance

#### Scenario: Late final belongs to history
- **WHEN** a final result belongs to a segment older than the current active cue but within history retention
- **THEN** the system updates or creates the history segment and leaves the active cue unchanged

### Requirement: Preserve revision provenance
The system MUST record internally whether a revision came from ASR partial correction, ASR finalization, translation correction, refinement correction, provider reconnect, manual fallback, active-lane supersession, or history backfill without requiring new client-visible provenance labels.

#### Scenario: Subtitle is revised
- **WHEN** a subtitle segment receives a newer revision
- **THEN** session history records the revision source and revision number

#### Scenario: Refined subtitle is revised
- **WHEN** a refinement result updates a subtitle
- **THEN** session history and diagnostics record the refinement provider, model, latency, and revision provenance

#### Scenario: Partial is superseded
- **WHEN** a partial translation job is discarded because newer speech superseded it
- **THEN** diagnostics record active-lane supersession without creating a misleading history subtitle

#### Scenario: History backfill applied
- **WHEN** a late final ASR or translation result updates history
- **THEN** session history and diagnostics record history backfill provenance
