## MODIFIED Requirements

### Requirement: Support readable bilingual display
The system SHALL support displaying source text and valid translated text together in lyric mode, with translated text visually prioritized by default, explicit waiting or recoverable failure states when no valid translation exists, and no scrollbars in the primary caption surfaces.

#### Scenario: Bilingual subtitles shown
- **WHEN** a valid translated cue is available
- **THEN** the UI displays translated text prominently and source text as supporting context

#### Scenario: Translation is pending
- **WHEN** source text is available and no translation attempt has completed successfully or failed terminally
- **THEN** the translated-text slot shows the existing compact waiting state instead of duplicating source text

#### Scenario: Translation fails after a valid draft
- **WHEN** the current segment has a previous valid translated draft and a later translation attempt fails
- **THEN** the UI keeps the previous valid translation visible and indicates that recovery is pending or translation is temporarily unavailable

#### Scenario: Translation fails without a valid draft
- **WHEN** the current segment has no valid translation and its bounded recovery is pending or exhausted
- **THEN** the translated-text slot shows a compact recoverable failure state and does not render source text as translated text

#### Scenario: Cue text is long
- **WHEN** source or translated cue text exceeds the available subtitle area
- **THEN** the UI wraps, clamps, scales, or fades within stable bounds without overlapping controls, unrelated content, or introducing a visible scrollbar

#### Scenario: Caption controls visible
- **WHEN** the user hovers over the floating caption window while it is unlocked
- **THEN** lightweight controls for close, lock, size, and opacity become available without covering the active subtitle text

### Requirement: Expose session history
The system SHALL keep a session history of interpreted cues during the current app session while keeping the active lyric cue primary and preserving whether each segment has a valid translation.

#### Scenario: User reviews previous subtitles
- **WHEN** the user opens session history
- **THEN** the system shows recent source text, valid translated text when available, timestamps, and revision status in a drawer, sidebar, or secondary panel

#### Scenario: Final segment has no valid translation
- **WHEN** a final segment is written to history after its bounded recovery fails
- **THEN** history retains the source text and an explicit unavailable translation state without copying source text into the translated-text row

#### Scenario: History recovery succeeds
- **WHEN** a valid recovery translation arrives for a segment already present in history
- **THEN** the system revises the matching history entry in place and replaces the unavailable state with the recovered translation

### Requirement: Provide accessible desktop controls
The system MUST provide visible labels, keyboard-accessible controls, readable contrast, and non-disruptive loading or error states for live capture and provider sessions, and MUST preserve translation failures until they are resolved or explicitly reset.

#### Scenario: Service is connecting
- **WHEN** ASR or translation services are connecting
- **THEN** the UI shows a visible loading or connecting state without freezing controls that remain safe to use

#### Scenario: Capture or provider fails
- **WHEN** live capture or provider streaming fails
- **THEN** the UI shows a recoverable error state and keeps stop, source selection, and fallback controls available

#### Scenario: Audio chunks continue after translation failure
- **WHEN** a translation failure is visible and subsequent audio chunks continue to arrive
- **THEN** audio activity updates do not clear the translation failure

#### Scenario: Translation recovers
- **WHEN** the same segment receives a valid translation or final recovery result
- **THEN** the UI clears the corresponding translation failure and presents the recovered translation

#### Scenario: User resets interpretation state
- **WHEN** the user retries or restarts the session, changes language direction, or resets the session
- **THEN** obsolete translation failures are cleared with the associated translation scheduler state

#### Scenario: Client shell is resized
- **WHEN** the user resizes the main window or uses a compact display
- **THEN** controls and lyric captions remain readable without horizontal overflow or incoherent overlap
