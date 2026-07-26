## ADDED Requirements

### Requirement: Prioritize active realtime subtitle lane
The system SHALL maintain an active realtime subtitle lane that prioritizes the current or most recent speech segment over older partial translation work.

#### Scenario: Current speech advances while older translation is pending
- **WHEN** ASR emits a newer segment while an older partial translation is still queued or in flight
- **THEN** the system keeps the newer segment eligible for the active subtitle lane and prevents the older partial from reclaiming the main subtitle surface

#### Scenario: Older partial is superseded
- **WHEN** a partial segment revision is superseded by a newer revision or newer segment before translation completes
- **THEN** the system may discard that partial from the active lane and records the discard reason in diagnostics

### Requirement: Preserve final ASR through history backfill
The system MUST preserve final ASR segments for session history and translation backfill whenever practical, even when they are no longer active on the main subtitle surface.

#### Scenario: Final ASR arrives late
- **WHEN** a final ASR event arrives for a segment that is no longer the active cue
- **THEN** the system records or updates the segment in history without interrupting the current active subtitle

#### Scenario: Final translation returns late
- **WHEN** a translation result returns for a final segment that has moved out of the active lane
- **THEN** the system applies it as history backfill or a recent history revision instead of moving the main subtitle back to that segment

### Requirement: Bound active and backfill queues separately
The system SHALL bound active translation work and history backfill work with separate queue pressure rules.

#### Scenario: Active lane is full
- **WHEN** the active lane already has the configured in-flight or pending work
- **THEN** the system keeps only the latest active-eligible job and marks older active partial jobs as superseded

#### Scenario: Backfill lane is full
- **WHEN** final history backfill exceeds its configured queue depth
- **THEN** the system preserves the newest or most recent final segments first and records skipped backfill jobs in diagnostics

### Requirement: Prevent active subtitle rollback
The system MUST prevent late ASR, translation, or refinement results from rolling the main subtitle surface back to an older segment.

#### Scenario: Old result returns after active cue changed
- **WHEN** a provider result returns for a segment older than the active cue
- **THEN** the system applies it only to eligible history or diagnostics and leaves the active cue unchanged

#### Scenario: Recent cue still eligible
- **WHEN** a late result belongs to a cue still inside the revision window and the active cue has not advanced beyond the rollback guard
- **THEN** the system may revise that cue in place without changing the visible cue order

### Requirement: Report catch-up health
The system SHALL expose an internal catch-up diagnostic snapshot for active lag, superseded partials, late final backfills, active rollback blocks, active queue depth, backfill queue depth, and refinement pause state without adding client-visible controls or labels.

#### Scenario: Internal diagnostics sampled during fast speech
- **WHEN** verification samples diagnostics while speech is arriving faster than translations complete
- **THEN** the snapshot reports whether the system is tracking the active cue, backfilling history, dropping superseded partials, or pausing refinement

#### Scenario: Catch-up state recovers
- **WHEN** queue pressure clears and visible subtitle latency returns below the configured threshold
- **THEN** the internal snapshot reports the catch-up state as healthy or recovered

#### Scenario: Client renders catch-up behavior
- **WHEN** catch-up scheduling, history backfill, or refinement pressure state changes
- **THEN** the existing client controls and labels remain unchanged while current subtitle content continues through the existing surfaces

### Requirement: Meet fast-draft latency objective
The system MUST provide a reference verification mode in which successful provider-backed, non-fallback first drafts satisfy an average translation-eligible-to-visible latency of at most 500ms and a P95 latency of at most 900ms after session warm-up.

#### Scenario: Reference fast-draft benchmark completes
- **WHEN** a fixed English reference sample produces at least 50 translation-eligible partials after provider session warm-up
- **THEN** the report includes sample count, mean, P50, P95, maximum, error count, fallback count, and missing-timestamp count and evaluates the 500ms mean and 900ms P95 objectives

#### Scenario: Fast-draft objective is missed
- **WHEN** the reference benchmark exceeds the mean or P95 objective
- **THEN** the change is reported as failing the fast-draft latency acceptance criterion with the slow stage and queue pressure evidence preserved

### Requirement: Meet end-to-end and catch-up objectives
The system MUST evaluate provider-backed first drafts against an end-to-end P50 objective of 800ms, an end-to-end P95 objective of 1500ms, an active lag limit of one cue, and a catch-up recovery objective of 2 seconds in the reference scenario.

#### Scenario: End-to-end sample is aggregated
- **WHEN** a first draft has correlated audio-evidence-end and first-visible timestamps
- **THEN** the report includes that sample in end-to-end P50 and P95 calculations

#### Scenario: Rapid speech creates pressure
- **WHEN** the reference scenario advances faster than translation responses complete
- **THEN** the active surface remains no more than one cue behind the latest translation-eligible segment and returns to healthy state within 2 seconds after pressure clears

#### Scenario: External provider variance prevents target
- **WHEN** provider, rate-limit, or network errors prevent the reference objectives from being met
- **THEN** verification records those errors separately and does not silently classify missing or fallback samples as successful latency samples
