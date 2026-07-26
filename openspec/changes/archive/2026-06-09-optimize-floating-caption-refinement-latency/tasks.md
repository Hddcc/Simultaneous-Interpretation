## 1. Floating Lyric Window

- [x] 1.1 Extend floating caption state and preload/main IPC types for locked state, mouse passthrough, opacity, font scale, window position, and hover controls.
- [x] 1.2 Implement draggable frameless floating caption behavior with preserved in-session bounds and main-client reset controls.
- [x] 1.3 Add lock/unlock behavior, including hidden hover controls and optional mouse event passthrough when locked.
- [x] 1.4 Redesign floating caption CSS into a NetEase-style lyric overlay with bilingual source/translation layout, previous cue fade, no scrollbars, and stable dimensions.
- [x] 1.5 Add dynamic text fitting for long English, Chinese, formulas, and technical terms without visible scrollbars or content overlap.
- [x] 1.6 Add tests or scenario checks for floating caption state, lock controls, mouse passthrough contract, and bilingual rendering data.

## 2. Subtitle Refinement Provider

- [x] 2.1 Add refinement request, response, diagnostics, provider metadata, and revision provenance types.
- [x] 2.2 Build refinement prompt messages that improve naturalness for both source and translated text while preserving meaning, terminology, numbers, formulas, and proper nouns.
- [x] 2.3 Implement refinement provider client by reusing the configured text provider and API key by default.
- [x] 2.4 Add optional `REFINEMENT_PROVIDER`, `REFINEMENT_MODEL`, and threshold configuration with defaults that preserve one-key Aliyun usage.
- [x] 2.5 Add provider failure fallback so fast translation remains visible when refinement fails.
- [x] 2.6 Add unit tests for prompt construction, provider selection, one-key Aliyun reuse, and failure fallback.

## 3. Refinement Scheduler And Revision Merge

- [x] 3.1 Implement bounded refinement scheduler with final/stable cue eligibility, dedupe, in-flight reuse, cache reuse, and queue pressure limits.
- [x] 3.2 Drop stale refinement responses that do not match the latest valid cue or subtitle revision.
- [x] 3.3 Merge refinement results into active cue or revision-window history without interrupting a newer active cue.
- [x] 3.4 Extend subtitle reconciliation and caption cue state to preserve refinement provenance, provider/model, latency, and revised state.
- [x] 3.5 Update floating captions and main lyric captions in place when refinement revisions apply.
- [x] 3.6 Add tests for refinement queue reuse, stale dropping, active cue revision, recent history revision, and provenance recording.

## 4. Low-Latency Pipeline Tuning

- [x] 4.1 Make realtime audio chunk duration configurable and lower the default cadence toward the 160-250ms range.
- [x] 4.2 Reduce ASR event polling latency or add provider event push from Electron main to renderer when new ASR events arrive.
- [x] 4.3 Make stable partial translation thresholds configurable for text length, word count, punctuation, debounce, and revision stability.
- [x] 4.4 Extend translation scheduler diagnostics with eligible skipped count, queued age, in-flight age, stale response age, and visible update latency.
- [x] 4.5 Add latency budget warnings for capture, ASR, translation, refinement, and visible cue update stages.
- [x] 4.6 Add tests for threshold configuration, diagnostic counters, and stale/queue pressure behavior.

## 5. Client Diagnostics And Verification

- [x] 5.1 Update diagnostics drawer to show fast translation, refinement, queue pressure, stale drops, and stage latency separately.
- [x] 5.2 Add desktop scenario verification entries for draggable floating lyrics, locked mouse passthrough, bilingual no-scroll captions, refinement revision, and latency tuning.
- [x] 5.3 Run build, caption cue tests, translation scheduler tests, refinement tests, desktop scenario tests, OpenSpec validation, and Electron smoke test.
- [x] 5.4 Verify compact, default, and wide floating caption sizes for English-to-Chinese and Chinese-to-English content.

## 6. Product Documentation

- [x] 6.1 Update README in Chinese product-usage style to explain draggable lyric subtitles, lock/mouse passthrough, bilingual layout, refinement, and latency tuning.
- [x] 6.2 Update verification docs with manual steps for browser video, meeting, call, floating lyric lock, and refinement comparison.
- [x] 6.3 Update tuning notes with chunk duration, partial thresholds, refinement eligibility, provider cost, and known limitations.
- [x] 6.4 Record dependency/originality notes for refinement provider reuse and floating lyric behavior.
