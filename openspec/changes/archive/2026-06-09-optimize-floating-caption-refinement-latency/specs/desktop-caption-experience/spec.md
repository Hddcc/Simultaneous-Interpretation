## MODIFIED Requirements

### Requirement: Provide floating caption window
The system SHALL provide a draggable floating lyric caption window that can remain visible above other applications during live realtime interpretation without showing scrollbars in normal caption use.

#### Scenario: User enables floating captions
- **WHEN** the user enables the floating caption window
- **THEN** the system shows a compact lyric subtitle window with current translated text, supporting source text, optional previous cue, and minimal session status

#### Scenario: User moves floating captions
- **WHEN** the user drags the floating caption body or drag handle
- **THEN** the floating caption window moves freely and preserves the latest position during the current session

#### Scenario: User locks floating captions
- **WHEN** the user locks the floating caption window
- **THEN** the window hides hover controls, preserves readability, and may allow mouse events to pass through to the application underneath

#### Scenario: User watches another application
- **WHEN** the user switches focus to a meeting, browser, media player, or call application
- **THEN** the floating caption window remains available for reading the active lyric cue

#### Scenario: Provider reconnects
- **WHEN** realtime interpretation is reconnecting or degraded
- **THEN** the floating caption window keeps the latest useful cue visible and shows a compact status label

### Requirement: Support readable bilingual display
The system SHALL support displaying source text and translated text together in lyric mode, with translated text visually prioritized by default and without scrollbars in the primary caption surfaces.

#### Scenario: Bilingual subtitles shown
- **WHEN** a translated cue is available
- **THEN** the UI displays translated text prominently and source text as supporting context

#### Scenario: Cue text is long
- **WHEN** source or translated cue text exceeds the available subtitle area
- **THEN** the UI wraps, clamps, scales, or fades within stable bounds without overlapping controls, unrelated content, or introducing a visible scrollbar

#### Scenario: Caption controls visible
- **WHEN** the user hovers over the floating caption window while it is unlocked
- **THEN** lightweight controls for close, lock, size, and opacity become available without covering the active subtitle text

## ADDED Requirements

### Requirement: Provide lyric-style floating caption controls
The system SHALL provide floating caption controls that feel like a native desktop lyric overlay.

#### Scenario: Hover controls idle
- **WHEN** the user is not interacting with the floating caption window
- **THEN** control chrome remains hidden or visually subdued so subtitles stay primary

#### Scenario: Main client controls locked window
- **WHEN** the floating caption is locked or mouse passthrough is enabled
- **THEN** the main client still provides a way to close, unlock, or reset the floating caption window
