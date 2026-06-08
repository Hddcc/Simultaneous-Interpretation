## MODIFIED Requirements

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
