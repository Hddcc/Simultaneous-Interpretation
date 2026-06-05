## MODIFIED Requirements

### Requirement: Provide main interpretation workbench
The system SHALL provide a desktop workbench that contains audio source controls, language controls, session controls, live subtitles, history, service status, provider health, queue state, and latency indicators.

#### Scenario: User opens the application
- **WHEN** the user opens the desktop app
- **THEN** the main workbench shows source selection, language direction, start or pause controls, and an empty live subtitle area

#### Scenario: Interpretation session is active
- **WHEN** an interpretation session is running
- **THEN** the workbench shows live original text, translated subtitles, audio activity, pipeline status, provider connection state, current latency, and recent history

### Requirement: Provide floating caption window
The system SHALL provide a floating caption window that can remain visible above other applications during live realtime interpretation.

#### Scenario: User enables floating captions
- **WHEN** the user enables the floating caption window
- **THEN** the system shows a compact subtitle window with current translated text and basic session status

#### Scenario: User watches another application
- **WHEN** the user switches focus to a meeting, browser, media player, or call application
- **THEN** the floating caption window remains available for reading subtitles

#### Scenario: Provider reconnects
- **WHEN** realtime interpretation is reconnecting or degraded
- **THEN** the floating caption window keeps the latest useful subtitle visible and shows a compact status label

### Requirement: Provide accessible desktop controls
The system MUST provide visible labels, keyboard-accessible controls, readable contrast, and non-disruptive loading or error states for live capture and provider sessions.

#### Scenario: Service is connecting
- **WHEN** ASR or translation services are connecting
- **THEN** the UI shows a visible loading or connecting state without freezing controls that remain safe to use

#### Scenario: Capture or provider fails
- **WHEN** live capture or provider streaming fails
- **THEN** the UI shows a recoverable error state and keeps stop, source selection, and fallback controls available
