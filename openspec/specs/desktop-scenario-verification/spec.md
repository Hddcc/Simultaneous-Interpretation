# desktop-scenario-verification Specification

## Purpose
Define the verification expectations for real desktop interpretation scenarios, including browser playback, meeting audio, call-style audio, microphone fallback, floating captions, and README-visible usage limits.
## Requirements
### Requirement: Verify browser video interpretation
The project MUST include a verification path showing that browser playback audio can produce live translated subtitles.

#### Scenario: Browser scenario is tested
- **WHEN** a browser plays English or Chinese speech and the app runs system audio interpretation
- **THEN** live source text and translated subtitles appear without requiring file upload

### Requirement: Verify meeting audio interpretation
The project MUST include a verification path for meeting-style audio from Tencent Meeting or a comparable desktop meeting application.

#### Scenario: Meeting scenario is tested
- **WHEN** a meeting app produces speech audio and the app runs system audio interpretation
- **THEN** the app captures audio or records a clear platform limitation and fallback path

### Requirement: Verify call-style audio interpretation
The project MUST include a verification path for WeChat or comparable call-style desktop audio.

#### Scenario: Call scenario is tested
- **WHEN** a call app produces speech audio and the app runs system audio interpretation
- **THEN** the app captures audio or records a clear platform limitation and fallback path

### Requirement: Verify floating captions over other apps
The project MUST verify that floating captions remain readable while the user focuses the browser, meeting app, player, or call app.

#### Scenario: User switches focus
- **WHEN** live interpretation is running and the user focuses another application
- **THEN** translated captions remain visible in the floating caption window

### Requirement: Keep README aligned with verified scenarios
The README MUST describe only supported live scenarios, required configuration, startup steps, and known limitations in Chinese product-usage style.

#### Scenario: Reviewer reads README
- **WHEN** a reviewer opens README after this change
- **THEN** they can understand how to configure and test realtime desktop interpretation without seeing internal PR/task checklist language

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
