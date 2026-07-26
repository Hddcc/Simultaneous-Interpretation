## MODIFIED Requirements

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

## ADDED Requirements

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
