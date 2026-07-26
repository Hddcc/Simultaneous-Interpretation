## MODIFIED Requirements

### Requirement: Maintain active lyric cue
The system SHALL maintain a single active lyric cue that represents the sentence or utterance currently being interpreted and is protected from late older results.

#### Scenario: First cue is created
- **WHEN** realtime ASR emits the first usable source text for an utterance
- **THEN** the system creates an active cue with source text, empty or draft translated text, cue state, revision, and timing metadata

#### Scenario: Cue replaces previous cue
- **WHEN** a newer utterance becomes the active cue
- **THEN** the previous cue moves out of the active position and is preserved as previous cue or session history

#### Scenario: Late older translation arrives
- **WHEN** a translation result arrives for a cue that is older than the active cue
- **THEN** the main lyric surface keeps the current active cue and routes the older result to eligible history or diagnostics

### Requirement: Expire stale active cues
The system MUST expire or demote stale active cues when speech pauses, newer speech supersedes them, or catch-up scheduling determines they are no longer current.

#### Scenario: Speech pauses after cue
- **WHEN** no newer ASR text arrives within the configured cue timeout
- **THEN** the active cue remains readable for a short hold period and then moves to history or idle state

#### Scenario: New speech supersedes old cue
- **WHEN** ASR emits text for a new segment while the previous active cue is still visible
- **THEN** the system promotes the new segment to active cue and demotes the previous cue

#### Scenario: Active cue lags behind speech
- **WHEN** ASR has advanced beyond the visible cue by more than the configured catch-up threshold
- **THEN** the system promotes the newest eligible cue to the active surface and keeps older cue completion in history

### Requirement: Preserve previous cue context
The system SHALL allow the user to retain short-term reading context and history backfill through the existing caption and history surfaces without letting previous or late-completed cues compete with the active lyric cue or requiring new client controls.

#### Scenario: Previous cue exists
- **WHEN** a previous cue is available during live interpretation
- **THEN** the UI can display it in a subdued secondary style or keep it available in history

#### Scenario: User opens history
- **WHEN** the user opens session history
- **THEN** the system shows prior cues through the existing history presentation and applies eligible backfill updates without adding a new backfill label or control

#### Scenario: History cue is completed late
- **WHEN** source or translation for an older final cue is completed after the active cue has advanced
- **THEN** the history entry updates without moving that cue back into the active lyric position
