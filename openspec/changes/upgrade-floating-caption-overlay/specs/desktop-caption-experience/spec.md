## MODIFIED Requirements

### Requirement: Provide floating caption window
The system SHALL provide a draggable floating lyric caption window that can remain visible above other applications during live realtime interpretation, sized to the caption it currently shows, without showing scrollbars in normal caption use.

#### Scenario: User enables floating captions
- **WHEN** the user enables the floating caption window
- **THEN** the system shows a compact lyric subtitle window with current translated text, supporting source text, optional previous cue, and minimal session status

#### Scenario: User moves floating captions
- **WHEN** the user drags the floating caption body or drag handle
- **THEN** the floating caption window moves freely and preserves the latest position during the current session

#### Scenario: User adjusts floating caption width
- **WHEN** the user steps the floating caption width from the overlay controls
- **THEN** the window width changes by a fixed increment within platform-safe bounds and keeps the edge nearest the screen border anchored

#### Scenario: Active cue needs more room
- **WHEN** the active cue needs more lines than the window reserves
- **THEN** the floating caption window height follows the caption content within bounded limits and grows away from the screen edge it is parked against

#### Scenario: Caption fits the reserved lines
- **WHEN** the active cue fits within the lines the window reserves
- **THEN** the floating caption window height does not change as the caption updates

#### Scenario: User locks floating captions
- **WHEN** the user locks the floating caption window
- **THEN** the window hides hover controls, preserves readability, and allows mouse events to pass through to the application underneath

#### Scenario: User watches another application
- **WHEN** the user switches focus to a meeting, browser, media player, or call application
- **THEN** the floating caption window remains available for reading the active lyric cue

#### Scenario: Client window is not in the foreground
- **WHEN** the main client window is minimized, occluded, or otherwise in the background while a session runs
- **THEN** realtime interpretation continues at its normal cadence instead of being throttled

#### Scenario: Provider reconnects
- **WHEN** realtime interpretation is reconnecting or degraded
- **THEN** the floating caption window keeps the latest useful cue visible and shows a compact status label

### Requirement: Provide lyric-style floating caption controls
The system SHALL provide floating caption controls that feel like a native desktop lyric overlay, including session control, and SHALL keep floating caption display preferences owned by the overlay.

#### Scenario: Hover controls idle
- **WHEN** the user is not interacting with the floating caption window
- **THEN** control chrome remains hidden or visually subdued so subtitles stay primary

#### Scenario: User starts or pauses from the overlay
- **WHEN** the user activates the start or pause control inside the floating caption window
- **THEN** the running interpretation session starts or pauses through the same session control as the main client, and the overlay control reflects the resulting session state

#### Scenario: Caption content refreshes
- **WHEN** new caption content is pushed to the floating caption window
- **THEN** the font scale, backdrop level, and lock state chosen inside the overlay are preserved

#### Scenario: Locked window needs to be released
- **WHEN** the floating caption window is locked with mouse passthrough and the pointer moves over it
- **THEN** an unlock affordance becomes reachable inside the overlay without disturbing the persisted lock preference

#### Scenario: Main client controls locked window
- **WHEN** the floating caption is locked or mouse passthrough is enabled
- **THEN** the main client still provides a way to close, unlock, or reset the floating caption window

## ADDED Requirements

### Requirement: Keep floating captions visually unobtrusive
The system SHALL render the floating caption window without an opaque background plate by default, so desktop content behind the captions stays visible, while keeping caption text legible on both light and dark desktops.

#### Scenario: Floating captions over desktop content
- **WHEN** the floating caption window is shown over another application
- **THEN** the area around the caption text is transparent and does not hide the content underneath

#### Scenario: Desktop background is light
- **WHEN** captions are shown over a light background
- **THEN** caption text remains legible through outline and shadow treatment rather than requiring an opaque plate

#### Scenario: User wants a stronger background
- **WHEN** the user cycles the floating caption backdrop control
- **THEN** the overlay switches between no backdrop, a subtle backdrop, and a solid backdrop, and the choice persists across caption updates

#### Scenario: Platform cannot compose transparent windows
- **WHEN** the platform cannot render a transparent overlay
- **THEN** the user can fall back to the solid backdrop level and keep reading captions
