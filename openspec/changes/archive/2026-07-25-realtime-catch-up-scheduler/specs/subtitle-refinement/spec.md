## MODIFIED Requirements

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
