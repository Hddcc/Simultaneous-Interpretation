## MODIFIED Requirements

### Requirement: Display lyric-style subtitles
The system SHALL render lyric-style subtitles by prioritizing the active cue, avoiding cumulative paragraph growth, showing the active cue in full rather than clipping it to a single line, and keeping the main and floating caption surfaces free of normal-use scrollbars.

#### Scenario: Active cue has translation
- **WHEN** the active cue contains translated text
- **THEN** the main caption surface displays that translation as the primary line and source text as supporting context

#### Scenario: Active cue updates
- **WHEN** the active cue receives newer ASR, translation, or refinement content
- **THEN** the visible cue updates in place without appending duplicate lines to the main caption surface

#### Scenario: Active cue wraps to several lines
- **WHEN** the active cue text is longer than one line at the current width and font size
- **THEN** the caption renderer wraps the cue across the lines it needs and the floating caption surface makes those lines visible instead of truncating after the first line

#### Scenario: Active cue is long
- **WHEN** active cue source or translated text exceeds the maximum caption surface allowed on the current display
- **THEN** the caption renderer applies stable wrapping, line limits, dynamic sizing, or fade treatment without adding a visible scrollbar

#### Scenario: User changes floating caption font size
- **WHEN** the user changes the floating caption font size
- **THEN** the visible line count adjusts to the new size and the chosen size is retained for later cues

### Requirement: Keep the lyric surface visually stable
The system SHALL keep the floating caption surface visually stable while a cue is being translated, so the reader can follow which sentence is live instead of watching the surface resize on every update.

#### Scenario: Translation streams in
- **WHEN** the active cue's translated text grows while it is still being translated
- **THEN** the caption lines keep their position and the floating caption window height stays unchanged as long as the text fits the reserved lines

#### Scenario: Cue needs more than the reserved lines
- **WHEN** the active cue needs more lines than the surface reserves
- **THEN** the surface grows immediately so no text is clipped

#### Scenario: A shorter cue follows a longer one
- **WHEN** a shorter cue replaces a cue that had grown beyond the reserved lines
- **THEN** the surface keeps the larger size until the measurement has held still, instead of shrinking on the first shorter update

#### Scenario: Reader looks for the live sentence
- **WHEN** a previous cue and an active cue are both available
- **THEN** the previous cue is shown in a subdued style above the active cue, and the active cue is the visually dominant line

#### Scenario: No previous cue exists yet
- **WHEN** the session has not produced a previous cue
- **THEN** the space reserved for it is left blank without changing the caption surface height

### Requirement: Synchronize floating lyric captions
The system SHALL synchronize the floating caption window with the same active lyric cue used by the main window, including translation and refinement revisions, without letting caption synchronization overwrite floating caption display preferences.

#### Scenario: Floating caption is visible
- **WHEN** the active cue changes in the main session
- **THEN** the floating caption window updates to the current cue without showing provider diagnostics by default

#### Scenario: Active cue revised
- **WHEN** the active cue translation or refined text changes after a final ASR, translation correction, or refinement correction
- **THEN** the floating caption updates in place and may show a subtle revised state

#### Scenario: Bilingual floating caption visible
- **WHEN** a floating caption has source text and translated text
- **THEN** the floating caption displays both languages together with translated text visually prioritized

#### Scenario: Overlay preferences are set
- **WHEN** the user has adjusted floating caption display preferences and a new cue arrives
- **THEN** the new cue is rendered using those preferences rather than resetting them to defaults
