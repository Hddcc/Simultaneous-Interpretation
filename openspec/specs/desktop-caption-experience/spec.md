## Purpose

Define the main desktop workbench and floating caption experience used to view live bilingual interpretation while working in other applications.
## Requirements
### Requirement: Provide main interpretation workbench
The system SHALL provide an integrated desktop client shell that contains source controls, language controls, session controls, a lyric-style active subtitle surface, compact status, optional history, settings, and diagnostics.

#### Scenario: User opens the application
- **WHEN** the user opens the desktop app
- **THEN** the main client shows source selection, language direction, primary start/stop control, and an empty lyric subtitle area in a coordinated desktop layout

#### Scenario: Interpretation session is active
- **WHEN** an interpretation session is running
- **THEN** the client shows the active lyric cue, audio activity, compact pipeline status, current latency, and access to recent history without exposing provider debug metadata by default

#### Scenario: User needs diagnostics
- **WHEN** the user opens diagnostics or advanced status
- **THEN** the client shows provider connection state, queue state, payload state, and detailed latency information in a secondary surface

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

### Requirement: Expose session history
The system SHALL keep a session history of interpreted cues during the current app session while keeping the active lyric cue primary.

#### Scenario: User reviews previous subtitles
- **WHEN** the user opens session history
- **THEN** the system shows recent source text, translated text, timestamps, and revision status in a drawer, sidebar, or secondary panel

### Requirement: Provide accessible desktop controls
The system MUST provide visible labels, keyboard-accessible controls, readable contrast, and non-disruptive loading or error states for live capture and provider sessions.

#### Scenario: Service is connecting
- **WHEN** ASR or translation services are connecting
- **THEN** the UI shows a visible loading or connecting state without freezing controls that remain safe to use

#### Scenario: Capture or provider fails
- **WHEN** live capture or provider streaming fails
- **THEN** the UI shows a recoverable error state and keeps stop, source selection, and fallback controls available

#### Scenario: Client shell is resized
- **WHEN** the user resizes the main window or uses a compact display
- **THEN** controls and lyric captions remain readable without horizontal overflow or incoherent overlap

### Requirement: Use integrated desktop visual system
The system SHALL use a coordinated desktop visual system rather than a card-heavy web dashboard layout.

#### Scenario: Main client rendered
- **WHEN** the main client is displayed
- **THEN** the UI uses a consistent shell, sidebar or toolbar, restrained surfaces, coherent spacing, and native-feeling controls

#### Scenario: Debug metadata exists
- **WHEN** provider metadata, queue state, payload state, or model names are available
- **THEN** the UI keeps them out of the primary caption experience unless the user opens diagnostics

### Requirement: Provide lyric-style floating caption controls
The system SHALL provide floating caption controls that feel like a native desktop lyric overlay.

#### Scenario: Hover controls idle
- **WHEN** the user is not interacting with the floating caption window
- **THEN** control chrome remains hidden or visually subdued so subtitles stay primary

#### Scenario: Main client controls locked window
- **WHEN** the floating caption is locked or mouse passthrough is enabled
- **THEN** the main client still provides a way to close, unlock, or reset the floating caption window
