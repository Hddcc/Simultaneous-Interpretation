## ADDED Requirements

### Requirement: Configure language direction
The system SHALL allow users to choose English to Chinese or Chinese to English as the active interpretation direction for the first version.

#### Scenario: User chooses English to Chinese
- **WHEN** the user selects English to Chinese
- **THEN** the system configures ASR and translation for English source audio and Chinese output

#### Scenario: User chooses Chinese to English
- **WHEN** the user selects Chinese to English
- **THEN** the system configures ASR and translation for Chinese source audio and English output

### Requirement: Store language pairs as structured configuration
The system MUST represent language direction as structured configuration rather than hard-coded branching scattered through the application.

#### Scenario: Pipeline reads active language pair
- **WHEN** the interpretation pipeline starts
- **THEN** it receives a structured language pair containing source language, target language, and provider-specific configuration values

### Requirement: Allow future language extension
The system SHALL make it possible to add future languages by extending configuration and provider mappings.

#### Scenario: New language added later
- **WHEN** a developer adds a new supported language pair in configuration
- **THEN** the UI and pipeline can reference the new pair without rewriting the core audio ingestion or subtitle revision model

### Requirement: Persist user preference
The system SHALL remember the last selected language direction between app sessions.

#### Scenario: App restarts
- **WHEN** the user restarts the desktop application
- **THEN** the previously selected language direction is restored if it is still supported
