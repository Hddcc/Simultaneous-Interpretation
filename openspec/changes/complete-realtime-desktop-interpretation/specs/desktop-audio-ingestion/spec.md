## MODIFIED Requirements

### Requirement: Normalize audio chunks
The system MUST convert all supported audio sources into a common stream of timestamped audio chunks before sending audio to interpretation services. For live microphone and system audio sources, chunks MUST include real provider-ready audio payloads or secure references to encoded payloads.

#### Scenario: Different sources share one pipeline contract
- **WHEN** audio is captured from system audio, microphone, or file simulation
- **THEN** the downstream pipeline receives chunks with consistent audio format, timestamps, source type, stream status metadata, and provider payload availability

#### Scenario: Live source emits chunk payload
- **WHEN** microphone or system audio is streaming
- **THEN** each downstream ASR chunk contains real audio data suitable for realtime provider streaming

## ADDED Requirements

### Requirement: Distinguish mock, file, and live realtime sources
The system SHALL distinguish mock simulation, file transcription, and live realtime interpretation in source state and provider routing.

#### Scenario: User starts live system audio
- **WHEN** the selected source is system audio and realtime provider mode is enabled
- **THEN** the pipeline uses live captured audio chunks rather than file transcription or mock text generation
