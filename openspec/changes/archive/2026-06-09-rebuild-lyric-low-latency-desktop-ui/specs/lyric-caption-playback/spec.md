## ADDED Requirements

### Requirement: Maintain active lyric cue
The system SHALL maintain a single active lyric cue that represents the sentence or utterance currently being interpreted.

#### Scenario: First cue is created
- **WHEN** realtime ASR emits the first usable source text for an utterance
- **THEN** the system creates an active cue with source text, empty or draft translated text, cue state, revision, and timing metadata

#### Scenario: Cue replaces previous cue
- **WHEN** a newer utterance becomes the active cue
- **THEN** the previous cue moves out of the active position and is preserved as previous cue or session history

### Requirement: Display lyric-style subtitles
The system SHALL render lyric-style subtitles by prioritizing the active cue and avoiding cumulative paragraph growth in the main caption surface.

#### Scenario: Active cue has translation
- **WHEN** the active cue contains translated text
- **THEN** the main caption surface displays that translation as the primary line and source text as supporting context

#### Scenario: Active cue updates
- **WHEN** the active cue receives newer ASR or translation content
- **THEN** the visible cue updates in place without appending duplicate lines to the main caption surface

### Requirement: Preserve previous cue context
The system SHALL allow the user to retain short-term reading context without letting history compete with the active lyric cue.

#### Scenario: Previous cue exists
- **WHEN** a previous cue is available during live interpretation
- **THEN** the UI can display it in a subdued secondary style or keep it available in history

#### Scenario: User opens history
- **WHEN** the user opens session history
- **THEN** the system shows prior cues in chronological or reverse chronological order with source, translation, timestamp, and revision status

### Requirement: Synchronize floating lyric captions
The system SHALL synchronize the floating caption window with the same active lyric cue used by the main window.

#### Scenario: Floating caption is visible
- **WHEN** the active cue changes in the main session
- **THEN** the floating caption window updates to the current cue without showing provider diagnostics by default

#### Scenario: Active cue revised
- **WHEN** the active cue translation is revised
- **THEN** the floating caption updates in place and may show a subtle revised state

### Requirement: Expire stale active cues
The system MUST expire or demote stale active cues when speech pauses or newer speech supersedes them.

#### Scenario: Speech pauses after cue
- **WHEN** no newer ASR text arrives within the configured cue timeout
- **THEN** the active cue remains readable for a short hold period and then moves to history or idle state

#### Scenario: New speech supersedes old cue
- **WHEN** ASR emits text for a new segment while the previous active cue is still visible
- **THEN** the system promotes the new segment to active cue and demotes the previous cue
