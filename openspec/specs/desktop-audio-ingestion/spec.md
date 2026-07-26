## Purpose

Define how the desktop app selects, captures, normalizes, and reports audio input from system playback, microphone input, and local file simulation.
## Requirements
### Requirement: Select audio input source
The system SHALL allow users to select one active audio source from computer/system audio, microphone audio, or local file simulation.

#### Scenario: User selects system audio
- **WHEN** the user selects computer/system audio as the input source
- **THEN** the system prepares to capture audio currently played by the computer and shows the selected source in the UI

#### Scenario: User selects microphone audio
- **WHEN** the user selects microphone audio as the input source
- **THEN** the system prepares to capture microphone input and shows the selected device in the UI

#### Scenario: User selects local file simulation
- **WHEN** the user selects a local audio or video file
- **THEN** the system prepares to feed the file audio into the pipeline at real-time playback speed

### Requirement: Normalize audio chunks
The system MUST convert all supported audio sources into a common stream of timestamped audio chunks before sending audio to interpretation services. For live microphone and system audio sources, chunks MUST include real provider-ready audio payloads or secure references to encoded payloads and MUST be adaptable to provider-specific realtime ASR formats such as Aliyun `fun-asr-realtime`.

#### Scenario: Different sources share one pipeline contract
- **WHEN** audio is captured from system audio, microphone, or file simulation
- **THEN** the downstream pipeline receives chunks with consistent audio format, timestamps, source type, stream status metadata, and provider payload availability

#### Scenario: Live source emits chunk payload
- **WHEN** microphone or system audio is streaming
- **THEN** each downstream ASR chunk contains real audio data suitable for realtime provider streaming

#### Scenario: Aliyun ASR consumes live audio
- **WHEN** Aliyun realtime ASR is selected
- **THEN** captured audio chunks are sent in an encoding, sample rate, and channel layout accepted by `fun-asr-realtime` or the UI shows a recoverable format error

### Requirement: Report capture status
The system SHALL expose audio capture status, volume activity, and recoverable capture errors to the user.

#### Scenario: Capture starts successfully
- **WHEN** an audio source starts streaming
- **THEN** the UI shows active capture status and live volume activity

#### Scenario: Capture fails
- **WHEN** the selected audio source cannot be captured
- **THEN** the UI shows a recoverable error message and keeps source selection available

### Requirement: Distinguish mock, file, and live realtime sources
The system SHALL distinguish mock simulation, file transcription, and live realtime interpretation in source state and provider routing.

#### Scenario: User starts live system audio
- **WHEN** the selected source is system audio and realtime provider mode is enabled
- **THEN** the pipeline uses live captured audio chunks rather than file transcription or mock text generation
