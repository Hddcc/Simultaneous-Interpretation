# native-system-audio-capture Specification

## Purpose
Define the Windows-first system playback audio capture behavior, helper capability reporting, provider-ready audio frame requirements, fallback paths, and cleanup expectations for live desktop interpretation.

## Requirements
### Requirement: Capture Windows system playback audio
The system SHALL capture real computer playback audio on Windows through a loopback-capable capture path suitable for browser, meeting, media player, and call audio.

#### Scenario: Browser video is playing
- **WHEN** the user selects system audio and starts interpretation while a browser video is playing
- **THEN** the system captures the browser playback audio as a live audio stream

#### Scenario: Meeting app is playing audio
- **WHEN** the user selects system audio and starts interpretation while a meeting app is producing sound
- **THEN** the system captures the meeting playback audio or shows a recoverable capture limitation message

### Requirement: Expose capture device and helper status
The system MUST show whether the native or helper capture path is available, active, degraded, or unavailable.

#### Scenario: Loopback helper is unavailable
- **WHEN** the app cannot start the loopback helper or access the output device
- **THEN** the UI explains the problem and offers microphone, file simulation, or existing desktop capture fallback

### Requirement: Provide real PCM or encoded audio frames
The capture path MUST emit real audio frames with sequence numbers, timestamps, sample rate, channels, duration, encoding, and source metadata.

#### Scenario: Playback audio is captured
- **WHEN** the system audio source is streaming
- **THEN** downstream ASR code receives provider-ready audio data rather than metadata-only simulated chunks

### Requirement: Stop capture cleanly
The capture path MUST stop helper processes, release devices, and close streams when the user pauses, stops, switches source, or exits the app.

#### Scenario: User stops interpretation
- **WHEN** the user stops an active system audio session
- **THEN** the helper and device resources are released without leaving background capture running
