## ADDED Requirements

### Requirement: Refine bilingual subtitle text
The system SHALL provide a non-blocking refinement channel that improves the naturalness of source and translated subtitle text without delaying the first visible translation.

#### Scenario: Final cue enters refinement
- **WHEN** a cue reaches final or sufficiently stable translated state
- **THEN** the system may enqueue a refinement request containing source text, translated text, language direction, recent context, revision, and terminology hints

#### Scenario: Refined text is produced
- **WHEN** the refinement provider returns improved source or translated text for the latest valid revision
- **THEN** the system emits a refinement revision for the same cue or subtitle segment

### Requirement: Preserve meaning and terminology
The system MUST instruct refinement providers to preserve the original meaning, technical terms, names, numbers, formulas, and language direction.

#### Scenario: Technical content refined
- **WHEN** source or translated text contains technical terms, product names, formulas, numbers, or proper nouns
- **THEN** the refined result preserves those terms unless the provider is correcting obvious ASR punctuation or spacing

#### Scenario: Natural Chinese output
- **WHEN** English source text is translated to Chinese and then refined
- **THEN** the Chinese subtitle uses natural spoken or written Chinese while keeping the original meaning

#### Scenario: Natural English output
- **WHEN** Chinese source text is translated to English and then refined
- **THEN** the English subtitle is grammatically natural and subtitle-friendly while keeping the original meaning

### Requirement: Reuse configured provider by default
The system SHALL reuse the configured text provider and local API key for refinement unless a dedicated refinement provider is configured.

#### Scenario: Aliyun one-key mode active
- **WHEN** ASR, translation, and refinement run in Aliyun mode
- **THEN** the system uses the existing `DASHSCOPE_API_KEY` and configured Qwen-compatible model without requiring another key

#### Scenario: Refinement provider unavailable
- **WHEN** refinement cannot be called because configuration, provider, network, or quota is unavailable
- **THEN** the system keeps the fast translation visible and records a recoverable refinement diagnostic

### Requirement: Bound refinement queue pressure
The system MUST deduplicate, limit, and drop stale refinement jobs so refinement does not degrade realtime subtitle speed.

#### Scenario: Duplicate cue revision enqueued
- **WHEN** the same cue revision is queued for refinement more than once
- **THEN** the system reuses queued, in-flight, or cached refinement results

#### Scenario: Newer cue revision supersedes refinement
- **WHEN** a newer revision of the same cue appears before refinement completes
- **THEN** the stale refinement result is ignored for visible subtitles and recorded only in diagnostics

#### Scenario: Refinement queue is overloaded
- **WHEN** refinement queue pressure exceeds the configured limit
- **THEN** the system prioritizes the newest active or recent final cue and drops older pending refinement jobs

### Requirement: Track refinement diagnostics
The system SHALL track refinement latency, provider, model, queue depth, dropped stale count, and failure reason separately from fast translation diagnostics.

#### Scenario: Refinement result applied
- **WHEN** a refined subtitle revision is applied
- **THEN** diagnostics show refinement latency and provider/model metadata for that revision

#### Scenario: Refinement delayed
- **WHEN** refinement latency exceeds the configured warning threshold
- **THEN** the system records a diagnostic warning without blocking active subtitle display
