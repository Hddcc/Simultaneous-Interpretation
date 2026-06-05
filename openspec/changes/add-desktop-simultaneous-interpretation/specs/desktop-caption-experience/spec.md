## ADDED Requirements

### Requirement: Provide main interpretation workbench
The system SHALL provide a desktop workbench that contains audio source controls, language controls, session controls, live subtitles, history, and service status.

#### Scenario: User opens the application
- **WHEN** the user opens the desktop app
- **THEN** the main workbench shows source selection, language direction, start or pause controls, and an empty live subtitle area

#### Scenario: Interpretation session is active
- **WHEN** an interpretation session is running
- **THEN** the workbench shows live original text, translated subtitles, audio activity, pipeline status, and recent history

### Requirement: Provide floating caption window
The system SHALL provide a floating caption window that can remain visible above other applications.

#### Scenario: User enables floating captions
- **WHEN** the user enables the floating caption window
- **THEN** the system shows a compact subtitle window with current translated text and basic session status

#### Scenario: User watches another application
- **WHEN** the user switches focus to a meeting, browser, media player, or call application
- **THEN** the floating caption window remains available for reading subtitles

### Requirement: Support readable bilingual display
The system SHALL support displaying source text and translated text together, with translated text visually prioritized by default.

#### Scenario: Bilingual subtitles shown
- **WHEN** a translated segment is available
- **THEN** the UI displays translated text prominently and source text as supporting context

### Requirement: Expose session history
The system SHALL keep a session history of interpreted segments during the current app session.

#### Scenario: User reviews previous subtitles
- **WHEN** the user opens session history
- **THEN** the system shows recent source text, translated text, timestamps, and revision status

### Requirement: Provide accessible desktop controls
The system MUST provide visible labels, keyboard-accessible controls, readable contrast, and non-disruptive loading or error states.

#### Scenario: Service is connecting
- **WHEN** ASR or translation services are connecting
- **THEN** the UI shows a visible loading or connecting state without freezing controls that remain safe to use
