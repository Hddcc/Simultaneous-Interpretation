## 1. Latency Contract And Baseline

- [x] 1.1 Add correlated timing fields for audio evidence end, ASR receipt, translation eligibility, request start, first draft receipt, first visible commit, final visibility, and refinement visibility across provider, preload, renderer, cue, and subtitle types.
- [x] 1.2 Replace the global-latest-chunk ASR latency association with segment/revision audio-evidence timing and count provider events that cannot be correlated.
- [x] 1.3 Define fast-draft, end-to-end, final, and refinement latency calculations in one reusable metrics module without summing refinement into first-draft latency.
- [x] 1.4 Add a bounded session latency aggregator that reports sample count, mean, P50, P95, maximum, errors, fallbacks, and missing timestamps for provider-backed samples.
- [x] 1.5 Add unit tests for timestamp correlation, metric boundaries, percentile calculation, missing timestamps, fallback exclusion, and immutable first-draft samples after later revisions.
- [x] 1.6 Capture a pre-optimization fixed-sample baseline and record provider configuration, request count, latency distribution, and active cue lag.

## 2. ASR Event Push And Deduplication

- [x] 2.1 Extend preload and Electron main IPC contracts for provider ASR event push subscriptions with event identity and timing metadata.
- [x] 2.2 Emit realtime provider ASR events from Electron main to renderer as soon as they are received.
- [x] 2.3 Keep pull-based ASR event recovery and add event-id deduplication so push and pull cannot double-apply events.
- [x] 2.4 Preserve correlated timing metadata through push, pull recovery, reconnect buffers, and renderer conversion.
- [x] 2.5 Add tests for pushed ASR events, pull recovery, duplicate event suppression, timing preservation, and provider reconnect buffers.

## 3. Catch-Up Translation Scheduler

- [x] 3.1 Extend the internal scheduler diagnostic snapshot with active lane depth, backfill depth, superseded partials, cancellation attempts/results, late final backfills, rollback blocks, active lag, request count, and catch-up state.
- [x] 3.2 Split translation scheduling into an active lane and a separately bounded history backfill lane while preserving the translation client boundary.
- [x] 3.3 Limit the active lane to one in-flight job and one latest pending job by default.
- [x] 3.4 Replace older pending partials when a newer revision or segment becomes eligible and retain final segments for bounded backfill.
- [x] 3.5 Pass `AbortSignal` through the translation client and attempt to cancel superseded in-flight partial requests while rejecting all stale visible results.
- [x] 3.6 Ensure final backfill never blocks active-lane dispatch and apply explicit overflow diagnostics when its queue is full.
- [x] 3.7 Add tests for rapid multi-segment speech, active-lane limits, superseded pending jobs, in-flight cancellation, provider-ignored cancellation, backfill pressure, duplicate reuse, and stale responses.

## 4. Fast-Draft Provider Path

- [x] 4.1 Add a provider-compatible fast-draft model setting that defaults safely to the configured translation model and remains separate from refinement configuration.
- [x] 4.2 Add streaming translation support where the configured provider supports it, including IPC delivery of readable draft updates and a complete-response fallback.
- [x] 4.3 Define the minimum readable streamed draft boundary and update the same cue in place as later tokens arrive.
- [x] 4.4 Shorten translation prompts and context for the active fast-draft lane while preserving language direction, critical terminology, names, and numbers.
- [x] 4.5 Tune audio chunk cadence, partial character/word thresholds, and debounce from measured data without allowing unbounded request growth.
- [x] 4.6 Benchmark eligible low-latency model configurations with the same fixed sample and select a documented default that best satisfies the SLO and quality checks.
- [x] 4.7 Add tests for streamed first draft, complete-response fallback, unreadable short chunks, same-cue updates, abort handling, and fast-model configuration fallback.

## 5. Active Cue And History Backfill

- [x] 5.1 Extend caption cue and subtitle reconciliation state with first-draft timing, backfill provenance, and active rollback guard metadata.
- [x] 5.2 Prevent late translation, ASR, streaming token, or refinement results from moving the main subtitle surface back to an older segment.
- [x] 5.3 Apply late final ASR and final translation results to matching history entries when eligible.
- [x] 5.4 Preserve the original first-draft and end-to-end latency sample when final or refinement revisions update a cue.
- [x] 5.5 Record active-lane supersession, cancellation, and history-backfill provenance in internal state and diagnostics without adding client-visible metadata.
- [x] 5.6 Add tests for active cue no-rollback, first-draft timing immutability, late final history update, late translation backfill, streamed revision ordering, and revision-window boundaries.

## 6. Refinement Pressure Gate And Internal Diagnostics

- [x] 6.1 Add active lag, translation backlog, ASR queue pressure, and fast-draft latency inputs to the refinement pressure gate.
- [x] 6.2 Pause or skip new refinement jobs while catch-up pressure is active and resume only after pressure clears.
- [x] 6.3 Restrict returned refinement results to the current revision window or eligible history without affecting active-lane scheduling.
- [x] 6.4 Extend internal refinement diagnostics with pause state, pause reason, skipped count, resumed count, and separate latency distribution.
- [x] 6.5 Preserve the existing client JSX/CSS and interaction surface without adding or rearranging labels, buttons, panels, badges, settings, or controls for this change.
- [x] 6.6 Expose latency sample count, mean, P50, P95, maximum, missing timestamps, active/backfill depth, active lag, request/cancellation counts, superseded partials, late backfills, and rollback blocks through internal snapshots and verification reports.
- [x] 6.7 Add tests for refinement pause, skip, stale return, recovery, independent metrics, and unchanged client-visible controls and labels.

## 7. SLO Verification

- [x] 7.1 Build a deterministic timing harness for provider latency, rapid revisions, queue pressure, cancellation, and recovery without external API dependency.
- [x] 7.2 Add a fixed English reference sample runner that gathers at least 50 warmed-up provider-backed first-draft samples.
- [x] 7.3 Make the reference report fail when fast-draft mean exceeds 500ms or P95 exceeds 900ms, while reporting external errors and missing samples explicitly.
- [x] 7.4 Evaluate end-to-end P50 at 800ms, P95 at 1500ms, active lag at one cue, and pressure recovery at 2 seconds in the same report.
- [x] 7.5 Add desktop verification scenarios for Bilibili/Edge system audio, rapid speech, late translation, active no-rollback, history backfill, refinement pause/resume, and unchanged client-visible controls.
- [x] 7.6 Run build, latency metrics tests, ASR event tests, translation scheduler tests, provider streaming tests, caption cue tests, reconciliation tests, refinement tests, desktop scenario tests, and strict OpenSpec validation.

## 8. Product Documentation

- [x] 8.1 Update README in Chinese product-usage style to explain first-draft latency, end-to-end latency, catch-up, history backfill, provider-dependent limits, and that the optimization adds no client controls.
- [x] 8.2 Update latency tuning notes with timestamp definitions, SLO sample rules, active/backfill lanes, fast-draft configuration, refinement pressure, and safe threshold ranges.
- [x] 8.3 Document fixed-sample and Bilibili/Edge verification steps, required evidence, provider warm-up, and interpretation of mean/P50/P95.
- [x] 8.4 Update dependency/originality notes for the scheduler, metric aggregator, streaming integration, and any dependency change introduced during implementation.
