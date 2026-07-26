## MODIFIED Requirements

### Requirement: Display lyric-style subtitles
The system SHALL render lyric-style subtitles by prioritizing the active cue, avoiding cumulative paragraph growth, and keeping the main and floating caption surfaces free of normal-use scrollbars.

#### Scenario: Active cue has translation
- **WHEN** the active cue contains translated text
- **THEN** the main caption surface displays that translation as the primary line and source text as supporting context

#### Scenario: Active cue updates
- **WHEN** the active cue receives newer ASR, translation, or refinement content
- **THEN** the visible cue updates in place without appending duplicate lines to the main caption surface

#### Scenario: Active cue is long
- **WHEN** active cue source or translated text is too long for the current caption surface
- **THEN** the caption renderer applies stable wrapping, line limits, dynamic sizing, or fade treatment without adding a visible scrollbar

### Requirement: Synchronize floating lyric captions
The system SHALL synchronize the floating caption window with the same active lyric cue used by the main window, including translation and refinement revisions.

#### Scenario: Floating caption is visible
- **WHEN** the active cue changes in the main session
- **THEN** the floating caption window updates to the current cue without showing provider diagnostics by default

#### Scenario: Active cue revised
- **WHEN** the active cue translation or refined text changes after a final ASR, translation correction, or refinement correction
- **THEN** the floating caption updates in place and may show a subtle revised state

#### Scenario: Bilingual floating caption visible
- **WHEN** a floating caption has source text and translated text
- **THEN** the floating caption displays both languages together with translated text visually prioritized

## ADDED Requirements

### Requirement: Show refinement state subtly
The system SHALL indicate refinement revisions without disrupting the reading rhythm of lyric captions.

#### Scenario: Refined cue applied
- **WHEN** refined text replaces fast translation for the active cue
- **THEN** the cue updates in place with a subtle revised state and no duplicate lyric line

#### Scenario: Refinement pending
- **WHEN** a cue has visible fast translation and refinement is still pending
- **THEN** the primary caption remains readable without showing intrusive provider or queue labels
