# subtitle-refinement Specification

## Purpose
TBD - created by archiving change optimize-floating-caption-refinement-latency. Update Purpose after archive.
## Requirements
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
The system MUST deduplicate, limit, pause, and drop stale refinement jobs so refinement does not degrade realtime subtitle speed or compete with active catch-up translation.

#### Scenario: Duplicate cue revision enqueued
- **WHEN** the same cue revision is queued for refinement more than once
- **THEN** the system reuses queued, in-flight, or cached refinement results

#### Scenario: Newer cue revision supersedes refinement
- **WHEN** a newer revision of the same cue appears before refinement completes
- **THEN** the stale refinement result is ignored for visible subtitles and recorded only in diagnostics

#### Scenario: Refinement queue is overloaded
- **WHEN** refinement queue pressure exceeds the configured limit
- **THEN** the system prioritizes the newest active or recent final cue and drops older pending refinement jobs

#### Scenario: Realtime catch-up pressure is active
- **WHEN** active subtitle lane lag, ASR queue pressure, translation backlog, or visible latency exceeds the configured threshold
- **THEN** the system pauses new refinement jobs and keeps fast translation visible

#### Scenario: Catch-up pressure clears
- **WHEN** active subtitle lane and translation backlog return below the configured thresholds
- **THEN** the system may resume refinement for eligible recent or history cues

### Requirement: Track refinement diagnostics
The system SHALL track refinement latency, provider, model, queue depth, dropped stale count, pause state, pause reason, skipped count, and failure reason separately from fast translation diagnostics in internal telemetry without adding client-visible labels or controls.

#### Scenario: Refinement result applied
- **WHEN** a refined subtitle revision is applied
- **THEN** internal diagnostics record refinement latency and provider/model metadata for that revision without changing the cue's recorded first-draft or end-to-end latency

#### Scenario: Refinement delayed
- **WHEN** refinement latency exceeds the configured warning threshold
- **THEN** the system records a diagnostic warning without blocking active subtitle display

#### Scenario: Refinement paused
- **WHEN** refinement is paused because realtime catch-up pressure is active
- **THEN** internal diagnostics record the pause reason and number of skipped or deferred refinement jobs

