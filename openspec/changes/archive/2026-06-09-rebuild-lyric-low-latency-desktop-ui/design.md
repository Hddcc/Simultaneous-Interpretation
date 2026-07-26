## Context

The app currently has a working desktop audio → realtime ASR → Qwen translation path, but the user experience is still shaped like a debugging workbench. The main subtitle area can accumulate long paragraphs, history competes with the active subtitle, provider metadata is too visible, and translation often waits for a final ASR segment. For a user watching a class, meeting, conference, or call, the product needs to behave like a desktop caption companion: the current sentence is clear, previous text falls away naturally, and latency is optimized around comprehension rather than perfect final text.

The next change crosses UI, subtitle state, translation scheduling, floating captions, and provider event handling. It should be treated as a product architecture refactor rather than a narrow styling pass.

## Goals / Non-Goals

**Goals:**

- Present subtitles in a lyric-style model where the active cue is the center of attention.
- Reduce perceived latency by translating stable partial text before final ASR events arrive.
- Preserve correction ability through in-place cue revisions and recent-history updates.
- Rebuild the desktop UI as an integrated client with a coordinated visual system inspired by native desktop apps such as Codex.
- Make the floating caption window a first-class viewing surface.
- Keep diagnostics available without exposing them as the default product surface.

**Non-Goals:**

- Replace the current Electron/Vite/React stack.
- Add new language pairs beyond the already-supported extension points.
- Build a custom native WASAPI helper in this change.
- Guarantee broadcast-grade simultaneous interpretation quality for every provider and model.
- Add multi-user collaboration, account login, cloud storage, or billing.

## Decisions

### Decision 1: Introduce a `CaptionCue` state model

The UI should stop treating the latest subtitle list item as the primary display object. Instead, the realtime pipeline should derive a `CaptionCue`:

```text
CaptionCue
  id
  sourceText
  translatedText
  state: listening | drafting | translated | revising | final
  revision
  startedAtMs
  updatedAtMs
  expiresAtMs
  provider/model/latency metadata
```

The main window and floating window will both render the active cue. Session history becomes a secondary store fed by finalized or replaced cues.

Alternative considered: Continue rendering `subtitleSegments[0]`. This preserves less code but keeps the product coupled to list/history behavior and makes lyric-style transitions awkward.

### Decision 2: Use stable partial translation with final revision

The pipeline should not wait exclusively for ASR `final`. A partial segment becomes translation-eligible when it meets stability rules:

- text length or word count exceeds a threshold,
- text has not changed for a short debounce window,
- or a provider sends punctuation, pause, sentence end, or equivalent final-ish signal.

Translation results carry the source revision they were based on. If a newer ASR revision arrives before the translation completes, stale translation results are discarded or recorded only in diagnostics.

Alternative considered: Translate every partial. This gives earlier output but creates too many requests, flicker, and higher cost.

### Decision 3: Use a bounded low-latency translation queue

Translation should run through a small scheduler:

```text
ASR event
  ├─ normalize segment
  ├─ update active cue source
  ├─ decide translation eligibility
  ├─ enqueue translation job with segment revision
  ├─ drop superseded jobs
  └─ apply result only if still current
```

The scheduler should prefer the newest active cue, cancel or ignore old partial jobs, cache repeated `(segmentId, revision, languagePair)` requests, and expose latency metrics.

Alternative considered: Keep one `Promise.all(changedSegments.map(translate))` path. It is simple, but makes queue pressure and stale results hard to control.

### Decision 4: Rebuild UI around an integrated desktop shell

The main client should be a cohesive app surface:

```text
┌────────────────────────────────────────────────────────────┐
│ Title / compact status / source / language / primary action │
├───────────────┬────────────────────────────────────────────┤
│ Sidebar       │ Active lyric subtitle stage                 │
│ - Sources     │                                            │
│ - History     │   previous cue, active cue, source text      │
│ - Settings    │                                            │
│ - Diagnostics │                                            │
├───────────────┴────────────────────────────────────────────┤
│ compact transport: volume, latency, provider status          │
└────────────────────────────────────────────────────────────┘
```

Visual direction:

- light-first or neutral theme, with dark mode optional if already supported,
- calm system colors rather than neon dashboard colors,
- native-feeling side navigation and toolbar,
- fewer cards, fewer badges, fewer provider labels,
- icons for actions, text labels for primary flows,
- consistent spacing, border radius, typography, and focus states.

Alternative considered: Patch the existing dark card layout. It would reduce immediate effort but would keep the “web panel inside client” feeling the user explicitly rejected.

### Decision 5: Treat floating captions as the core playback UI

The floating window should render the same active cue state as the main window, with minimal chrome:

- source text small,
- translated text large,
- compact state indicator,
- optional previous cue,
- no debug metadata by default.

When a cue is revised, the floating window should update in place with a subtle transition instead of appending lines.

## Risks / Trade-offs

- [Risk] Stable partial translation may translate text that later changes meaning. → Mitigation: show it as draft/active cue, revise in place on final ASR, and keep final revision in history.
- [Risk] More frequent translation calls can increase cost and provider pressure. → Mitigation: debounce, dedupe, cache, and drop stale queued jobs.
- [Risk] Lyric-style replacement can hide useful previous text too quickly. → Mitigation: keep one previous cue visible in subdued style and provide a history drawer.
- [Risk] UI rewrite can regress existing capture/provider controls. → Mitigation: keep current IPC/provider contracts, add scenario tests, and verify desktop/microphone/file flows.
- [Risk] Audio/provider latency varies by machine and network. → Mitigation: define target ranges as product goals, expose diagnostics, and preserve graceful fallback behavior.
- [Risk] A light native-style UI can reduce contrast for subtitle reading. → Mitigation: use a high-contrast subtitle stage and verify text fit at desktop and compact floating sizes.

## Migration Plan

1. Add cue state and translation scheduler while keeping existing segment/history structures.
2. Route main and floating subtitle surfaces through active cue state.
3. Rebuild the main client shell and move diagnostics into a secondary drawer.
4. Replace history panel with drawer/sidebar history fed by finalized cues.
5. Validate provider, microphone, system audio, and file simulation flows.
6. Remove obsolete workbench/card UI code after parity is confirmed.

Rollback can fall back to the existing segment-based subtitle rendering if cue derivation or queue scheduling causes regressions.

## Open Questions

- Should the default main window theme be light-only for this change, or should dark mode remain selectable?
- Should floating captions show both original and translated text by default, or make source text optional?
- What latency target should be treated as release-blocking for the first lyric-mode version: 1.5s, 2s, or 3s?
- Should TTS remain in the main product surface, or move into settings until speech playback is production-quality?
