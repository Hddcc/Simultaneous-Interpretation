## 1. Lyric Cue State Model

- [x] 1.1 Add `CaptionCue` and cue state types for active, previous, history, revision, latency, and provider metadata.
- [x] 1.2 Implement cue derivation from ASR and translation events without removing the existing subtitle segment history.
- [x] 1.3 Add cue expiration and promotion rules for speech pause, new segment arrival, and final segment completion.
- [x] 1.4 Add unit tests for active cue creation, in-place revision, previous cue demotion, and stale cue expiration.

## 2. Low-Latency Translation Pipeline

- [x] 2.1 Replace direct per-segment translation calls with a bounded translation scheduler.
- [x] 2.2 Add stable partial translation eligibility using text length, word count, debounce timing, and segment revision.
- [x] 2.3 Deduplicate queued/in-flight/cached translation requests by segment id, revision, language pair, provider, and model.
- [x] 2.4 Drop stale translation responses that do not match the latest valid segment revision.
- [x] 2.5 Track ASR latency, translation latency, total latency, and visible cue update latency for diagnostics.
- [x] 2.6 Add tests for scheduler priority, stale result dropping, partial-to-final revision, cache reuse, and provider failure fallback.

## 3. Lyric Caption Rendering

- [x] 3.1 Render the main caption surface from active cue state instead of directly from the latest subtitle list item.
- [x] 3.2 Show one active cue prominently with source text as supporting context and optional previous cue in subdued style.
- [x] 3.3 Prevent cumulative paragraph growth in the main caption surface during long interpretation sessions.
- [x] 3.4 Apply subtle revised/final/drafting states without showing provider debug badges by default.
- [x] 3.5 Add responsive text fitting rules for long math, technical, English, and Chinese cue text.

## 4. Integrated Desktop Client UI

- [x] 4.1 Replace the card-heavy workbench layout with an integrated desktop shell: sidebar or toolbar, active lyric stage, compact controls, and secondary drawers.
- [x] 4.2 Move provider metadata, payload state, queue state, and detailed latency into a diagnostics drawer or advanced panel.
- [x] 4.3 Rework audio source, language direction, start/stop, retry, history, settings, and caption controls into a coordinated native-feeling control system.
- [x] 4.4 Replace the always-visible history panel with a history drawer or sidebar view that does not compete with the active cue.
- [x] 4.5 Apply a coherent visual system inspired by native desktop apps: restrained color, consistent spacing, readable type, clear focus states, and minimal badges.
- [x] 4.6 Verify main-window layout at compact, default, and wide desktop sizes without horizontal overflow or control overlap.

## 5. Floating Caption Experience

- [x] 5.1 Render the floating caption window from the same active cue state as the main window.
- [x] 5.2 Show translated text, supporting source text, compact status, and optional previous cue without diagnostics by default.
- [x] 5.3 Update floating captions in place when a cue is revised or finalized.
- [x] 5.4 Verify floating window text fitting and readability for English-to-Chinese and Chinese-to-English subtitles.

## 6. Verification And Product Documentation

- [x] 6.1 Add or update desktop scenario verification for lyric mode, low-latency partial translation, revision, history, and floating captions.
- [x] 6.2 Run build, relevant unit tests, OpenSpec validation, and Electron smoke test.
- [x] 6.3 Update README in Chinese product-usage style to describe lyric subtitles, faster realtime translation, and the redesigned desktop client.
- [x] 6.4 Record known limitations and tuning notes for latency thresholds, provider behavior, and source selection.
