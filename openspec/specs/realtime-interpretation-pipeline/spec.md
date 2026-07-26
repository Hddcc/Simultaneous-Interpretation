## Purpose

Define the streaming interpretation pipeline from normalized audio chunks through ASR, translation, context handling, and latency reporting.
## Requirements
### Requirement: Stream audio to ASR
The system SHALL send normalized audio chunks with real audio payloads to an ASR service in streaming mode, using a configurable low-latency chunk cadence, and receive partial and final recognition events, including Aliyun `fun-asr-realtime` when selected.

#### Scenario: Partial recognition arrives
- **WHEN** the ASR service emits a partial recognition event
- **THEN** the system publishes an interim source-text update with segment identity, revision, ASR receive time, and the end time of the audio evidence represented by that partial

#### Scenario: Final recognition arrives
- **WHEN** the ASR service emits a final recognition event
- **THEN** the system marks the source-text segment as final unless a later revision supersedes it and preserves it for history backfill

#### Scenario: Live system audio is active
- **WHEN** system playback audio is streaming in provider mode
- **THEN** ASR receives live audio chunks without requiring the user to upload a file

#### Scenario: Low-latency chunk cadence configured
- **WHEN** realtime provider mode is active
- **THEN** the system uses the configured chunk duration and records capture cadence diagnostics

#### Scenario: Aliyun one-key realtime pipeline is active
- **WHEN** live audio is streaming with `REALTIME_ASR_PROVIDER=aliyun` and `TRANSLATION_PROVIDER=aliyun`
- **THEN** the pipeline uses `fun-asr-realtime` for speech recognition and a Qwen text model for translation using `DASHSCOPE_API_KEY`

#### Scenario: ASR event is pushed from main process
- **WHEN** the Electron main process receives a realtime provider ASR event
- **THEN** it pushes the event to the renderer promptly and keeps pull-based recovery available for missed or buffered events

### Requirement: Translate recognized text
The system SHALL translate finalized or sufficiently stable partial source text between English and Chinese according to the active language direction using the configured translation provider, SHALL commit only text that is valid for the target language direction, and SHALL represent provider failure or cancellation separately from a successful translation.

#### Scenario: English source translated to Chinese
- **WHEN** the active language direction is English to Chinese and recognized English text becomes stable
- **THEN** the system emits a Chinese translation for the same segment

#### Scenario: Chinese source translated to English
- **WHEN** the active language direction is Chinese to English and recognized Chinese text becomes stable
- **THEN** the system emits an English translation for the same segment

#### Scenario: Stable partial text is available
- **WHEN** partial ASR text satisfies the configured stability threshold before a final ASR event arrives
- **THEN** the system may emit a target-language draft translation for the current segment and mark it as revision-capable

#### Scenario: Final text corrects draft translation
- **WHEN** a final ASR event supersedes a translated partial segment
- **THEN** the system requests or applies an updated valid translation and revises the same visible segment or cue

#### Scenario: Translation provider is unavailable
- **WHEN** stable ASR text is available but the translation provider request fails
- **THEN** the system keeps source text visible, emits a recoverable translation failure without placing source text in the translated-text field, and preserves any previous valid translation

#### Scenario: Stale partial request is cancelled
- **WHEN** the scheduler cancels an in-flight partial because a newer active revision supersedes it
- **THEN** the system discards the cancelled response without emitting source text as a translation or presenting the expected cancellation as a provider failure

#### Scenario: Provider returns source-language text
- **WHEN** a provider response is identical to the source or lacks the required target-language signal for text with a clear source-language signal
- **THEN** the system rejects the response as a recoverable untranslated result and does not commit it to active captions, history, or refinement

#### Scenario: Language-neutral literal is translated
- **WHEN** a segment consists only of numbers, symbols, abbreviations, or language-neutral names that may validly remain unchanged
- **THEN** target-language validation does not reject the result solely because normalized source and translated text are equal

#### Scenario: Qwen translation is used
- **WHEN** `TRANSLATION_PROVIDER=aliyun` and a stable ASR segment is ready
- **THEN** the system translates the segment with the configured Qwen model and records provider/model metadata on the subtitle or structured failure metadata on an unsuccessful attempt

### Requirement: Preserve recent context
The system MUST provide recent source and translated context to translation requests when context is available.

#### Scenario: Technical term continues across segments
- **WHEN** a new segment is translated after related recent segments
- **THEN** the translation request includes recent context so terminology and sentence continuity can remain consistent

### Requirement: Expose pipeline latency
The system SHALL measure interpretation latency with correlated timestamps for audio evidence, ASR receipt, translation eligibility, translation request, first draft receipt, first draft visibility, final visibility, and refinement visibility, and SHALL report fast-draft, end-to-end, final, and refinement latency separately.

#### Scenario: Subtitle event emitted
- **WHEN** a translated or refined subtitle event is emitted
- **THEN** internal telemetry and verification reports can expose the event's ASR, fast-draft, end-to-end, final, refinement, active-lane, and backfill measurements without adding refinement time to the first-draft latency

#### Scenario: First draft becomes visible
- **WHEN** the first readable translated draft for an eligible partial is committed to the active cue
- **THEN** fast-draft latency is measured from translation eligibility to visible commit and end-to-end latency is measured from the partial's audio-evidence end time to visible commit

#### Scenario: Required timestamp is missing
- **WHEN** a sample lacks the audio-evidence, eligibility, or first-visible timestamp required by an SLO metric
- **THEN** the system excludes that sample from the affected aggregate and increments a missing-timestamp diagnostic count

#### Scenario: Latency exceeds target
- **WHEN** current fast-draft or end-to-end latency, active-lane backlog, or refinement latency exceeds its configured warning threshold
- **THEN** the system records a diagnostic warning without blocking the active subtitle display

#### Scenario: Active subtitles fall behind
- **WHEN** the active subtitle lane is behind the latest ASR segment by more than the configured lag threshold
- **THEN** internal diagnostics report catch-up pressure and the scheduler prioritizes newest active-eligible work without adding client-visible status elements

#### Scenario: Refinement completes after first draft
- **WHEN** a refinement result updates a cue after its first draft was visible
- **THEN** the system reports refinement latency independently and preserves the original first-draft and end-to-end samples

### Requirement: Schedule low-latency translation jobs
The system SHALL schedule translation jobs through bounded active and backfill lanes that prefer the latest active cue while preserving final history where practical.

#### Scenario: New stable partial supersedes queued job
- **WHEN** a newer revision of the same segment becomes translation-eligible before the previous translation finishes
- **THEN** the system marks the older active-lane partial result as stale and applies only the latest valid revision to the active cue

#### Scenario: Multiple segments compete
- **WHEN** multiple partial or final segments are waiting for translation
- **THEN** the system prioritizes the current active cue in the active lane and moves older final work to the backfill lane when capacity allows

#### Scenario: Active lane pressure rises
- **WHEN** active-lane pending or in-flight work exceeds the configured limit
- **THEN** the system keeps the newest active-eligible job and supersedes older partial jobs with diagnostic provenance

#### Scenario: Fast draft provider path is available
- **WHEN** a translation-eligible partial enters an idle active lane and the provider supports a configured low-latency model or streaming response
- **THEN** the system uses that fast-draft path and publishes the first readable draft without waiting for final translation or refinement

#### Scenario: In-flight partial becomes stale
- **WHEN** a newer active revision supersedes an in-flight partial translation
- **THEN** the system attempts to cancel the stale provider request, excludes its response from the active cue, and records whether cancellation succeeded

#### Scenario: Final segment needs backfill
- **WHEN** a final segment is no longer active but lacks a translation
- **THEN** the system may enqueue it in the backfill lane without blocking active cue translation

### Requirement: Deduplicate translation requests
The system MUST avoid repeated translation requests for the same segment revision and language pair.

#### Scenario: Same revision arrives twice
- **WHEN** the pipeline receives duplicate ASR events for the same segment revision and text
- **THEN** the system reuses an existing queued, in-flight, or cached translation result

### Requirement: Drop stale realtime outputs
The system SHALL prevent stale ASR or translation outputs from applying to the active subtitle when they no longer match the current segment revision or active-lane guard.

#### Scenario: Old translation returns late
- **WHEN** a translation response returns for a source revision that has already been superseded
- **THEN** the system ignores it for the active cue and may apply it to history backfill if it belongs to a final segment

#### Scenario: Old partial returns late
- **WHEN** a translation response returns for an old partial that has been superseded by a newer revision or final segment
- **THEN** the system records it as superseded and does not apply it to active subtitles or history

#### Scenario: Final translation returns after active cue advanced
- **WHEN** a translation response returns for a final segment that has moved out of the active lane
- **THEN** the system updates the corresponding history segment and keeps the current active cue unchanged

### Requirement: Configure realtime latency thresholds
The system SHALL expose runtime or code-level configuration for audio chunk duration, ASR event cadence, stable partial thresholds, and refinement eligibility.

#### Scenario: User or developer tunes latency
- **WHEN** latency thresholds are changed in configuration
- **THEN** the realtime pipeline uses the new values without requiring core pipeline rewrites

#### Scenario: Thresholds are too aggressive
- **WHEN** queue pressure, dropped chunks, or stale outputs increase after threshold changes
- **THEN** diagnostics expose enough detail to identify the bottleneck

### Requirement: Recover failed final translations
The system SHALL make at most one bounded recovery attempt for a final subtitle that has no valid translation, using the configured complete translation model without blocking newer active partial translation work.

#### Scenario: Final fast translation fails
- **WHEN** a final ASR segment has no valid translation because its provider request failed or returned an untranslated result
- **THEN** the system enqueues one deduplicated recovery translation through bounded backfill capacity using the complete translation model

#### Scenario: Recovery succeeds while segment is active
- **WHEN** a recovery translation returns while its final segment is still the active cue
- **THEN** the system applies the valid translation to that cue and clears the segment's translation failure

#### Scenario: Recovery succeeds after active cue advances
- **WHEN** a recovery translation returns after a newer segment has become active
- **THEN** the system updates the matching history segment without rolling the active cue back

#### Scenario: Recovery also fails
- **WHEN** the single final recovery attempt fails or returns an invalid target-language result
- **THEN** the system preserves source text and any previous valid translation, records the terminal recoverable failure, and does not enqueue another automatic retry for that final revision

### Requirement: Preserve translation failure diagnostics
The system MUST record structured, non-secret diagnostics for unsuccessful translation attempts and recovery outcomes separately from successful latency samples.

#### Scenario: Provider rejects translation request
- **WHEN** a translation provider returns an HTTP or service error
- **THEN** diagnostics record provider, model, failure category, sanitized message, HTTP status or provider error code when available, segment revision, and failure time without recording credentials

#### Scenario: Untranslated provider output is rejected
- **WHEN** target-language validation rejects a provider response
- **THEN** diagnostics record an untranslated-output failure and exclude the result from successful translation and latency samples

#### Scenario: Final recovery completes
- **WHEN** a final recovery attempt succeeds or fails
- **THEN** diagnostics record that a recovery was attempted and its outcome for the corresponding segment revision

