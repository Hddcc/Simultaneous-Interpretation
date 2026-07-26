## 1. Stabilize Main Caption Structure

- [x] 1.1 Update the main caption markup in `src/App.tsx` to always render a fixed recent-context track and separate source and translation slot containers while preserving the existing cue text and accessibility labels.
- [x] 1.2 Update `src/styles.css` so the source slot holds two bottom-anchored lines, the translation slot holds four top-anchored lines, and the shared reading anchor remains fixed during same-cue revisions.
- [x] 1.3 Bound source and translation overflow with line clamping, remove the main caption scrollbar, and keep slot dimensions stable across empty, draft, final, and refined text states.
- [x] 1.4 Add responsive slot and recent-context sizing for the existing small, medium, and large font preferences and compact window breakpoints without overlap or horizontal overflow.

## 2. Extend Layout Verification Coverage

- [x] 2.1 Extend the existing lyric low-latency desktop scenario with checks for one-line to multi-line growth, partial/final/refinement replacement, recent-context count changes, bounded overflow, and stable source/translation anchors.
- [x] 2.2 Update the desktop scenario test assertions so the new caption stability checks and evidence requirements are required by the verification contract.

## 3. Verify Behavior

- [x] 3.1 Run the TypeScript/Vite build and the focused desktop, caption, history, and UI preference tests; resolve regressions introduced by this change.
- [x] 3.2 In the Electron main window, replay deterministic short and long cue revisions at supported font sizes and representative window sizes, confirming anchor movement stays within one CSS pixel after layout settles and no main-caption scrollbar appears.
- [x] 3.3 Run a continuous real-provider translation session, confirm the main bilingual subtitles remain readable without vertical jitter, and verify complete long cue text remains available in subtitle history.
