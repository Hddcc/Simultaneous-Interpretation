## ADDED Requirements

### Requirement: Verify catch-up behavior during fast speech
The project MUST include a verification path for fast speech or continuous multi-sentence audio that confirms active subtitles track current speech while history is backfilled.

#### Scenario: Fast speech scenario is tested
- **WHEN** a browser video, file sample, or meeting audio contains several consecutive sentences spoken faster than translation responses complete
- **THEN** the active subtitle remains near the newest ASR cue, older final segments appear in history, and diagnostics record catch-up state

#### Scenario: Late translation returns
- **WHEN** a translation for an older final segment returns after the active cue has advanced
- **THEN** verification confirms that the history entry updates and the active subtitle does not roll back

### Requirement: Verify refinement yields to realtime catch-up
The project MUST verify that refinement does not delay active subtitles when realtime catch-up pressure is present.

#### Scenario: Refinement pressure scenario is tested
- **WHEN** ASR or translation backlog exceeds the configured catch-up threshold
- **THEN** verification confirms that refinement pauses or skips new work and diagnostics show the pause reason

#### Scenario: Refinement resumes after recovery
- **WHEN** catch-up pressure clears
- **THEN** verification confirms that eligible recent or history cues can be refined without blocking current subtitles

### Requirement: Verify quantified latency objectives
The project MUST include deterministic scheduler tests and a provider-backed reference run that evaluate fast-draft, end-to-end, active-lag, and recovery objectives with correlated timestamps.

#### Scenario: Fixed reference sample is measured
- **WHEN** the latency verification run processes a fixed English sample after provider warm-up
- **THEN** it collects at least 50 eligible first-draft samples and outputs count, mean, P50, P95, maximum, errors, fallbacks, missing timestamps, request count, superseded count, and cancellation count

#### Scenario: Browser playback is manually verified
- **WHEN** an English browser video such as a Bilibili video is interpreted through system audio
- **THEN** the verification evidence records fast-draft and end-to-end distributions, active cue lag, provider configuration, network limitations, and whether the reference objectives were met

#### Scenario: Refinement latency is reported
- **WHEN** background refinement completes during a verification run
- **THEN** its latency is reported separately and cannot change the previously recorded first-draft or end-to-end latency sample
