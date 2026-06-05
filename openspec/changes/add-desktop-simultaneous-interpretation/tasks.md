## 1. PR 1 - Repository and Project Scaffold

- [x] 1.1 Initialize Git repository if needed, set `main` as the primary branch, and connect `origin` to `https://github.com/Hddcc/Simultaneous-Interpretation.git`.
- [x] 1.2 Create the initial Electron + React + TypeScript desktop app scaffold.
- [x] 1.3 Add `.gitignore`, `.env.example`, package scripts, and baseline development documentation.
- [x] 1.4 Verify the desktop app starts locally and opens an empty main window.
- [x] 1.5 Prepare a PR description covering scaffold purpose, setup commands, implementation approach, and verification.

## 2. PR 2 - Main Workbench UI Shell

- [x] 2.1 Build the main desktop workbench layout with top controls, central subtitle area, side history panel, and bottom status strip.
- [x] 2.2 Add placeholder states for audio source, language direction, session status, latency, and service connection.
- [x] 2.3 Apply accessible UI styling with readable contrast, visible labels, stable button states, and restrained loading indicators.
- [x] 2.4 Verify the UI renders correctly at common desktop window sizes.
- [x] 2.5 Prepare a PR description focused only on the workbench UI shell.

## 3. PR 3 - Audio Source Selection and File Simulation

- [x] 3.1 Implement the audio source selection model for system audio, microphone, and local file simulation.
- [x] 3.2 Implement local audio/video file selection and real-time simulated playback into the shared audio stream contract.
- [x] 3.3 Add UI status for selected source, active stream, volume activity, and recoverable source errors.
- [x] 3.4 Verify file simulation can produce timestamped audio chunks without calling AI services.
- [x] 3.5 Prepare a PR description focused only on source selection and file simulation.

## 4. PR 4 - Microphone Capture

- [x] 4.1 Implement microphone permission handling and device selection.
- [x] 4.2 Convert microphone input into normalized timestamped audio chunks.
- [x] 4.3 Add capture start, pause, stop, and error handling for microphone sessions.
- [x] 4.4 Verify microphone input shows volume activity and emits chunks through the shared stream contract.
- [x] 4.5 Prepare a PR description focused only on microphone capture.

## 5. PR 5 - System Audio Capture

- [x] 5.1 Investigate and implement the first supported system audio capture path for the target desktop environment.
- [x] 5.2 Convert captured computer playback audio into normalized timestamped audio chunks.
- [x] 5.3 Add fallback messaging when system audio capture is unavailable or permission is denied.
- [x] 5.4 Verify the app can capture audio from a browser, media player, or meeting app in the target environment.
- [x] 5.5 Prepare a PR description focused only on system audio capture and known platform limitations.

## 6. PR 6 - Realtime ASR Integration

- [x] 6.1 Add AI provider configuration loading from environment variables without committing secrets.
- [x] 6.2 Implement streaming ASR client integration for normalized audio chunks.
- [x] 6.3 Model partial and final ASR events with segment IDs, timestamps, and status.
- [x] 6.4 Render live source-text updates in the workbench for file or microphone input.
- [x] 6.5 Prepare a PR description focused only on realtime ASR integration and verification.

## 7. PR 7 - Bilingual Translation Pipeline

- [x] 7.1 Implement language pair configuration for English to Chinese and Chinese to English.
- [x] 7.2 Implement translation requests for stable ASR segments with recent context.
- [x] 7.3 Emit translated subtitle events linked to the original segment IDs.
- [x] 7.4 Display translated subtitles prominently with source text as supporting context.
- [x] 7.5 Prepare a PR description focused only on bilingual translation.

## 8. PR 8 - Revision-Aware Subtitle Updates

- [ ] 8.1 Implement versioned subtitle segments with stable IDs and revision numbers.
- [ ] 8.2 Update visible subtitles in place when ASR or translation corrections arrive.
- [ ] 8.3 Add a configurable recent revision window and preserve older visible subtitles.
- [ ] 8.4 Add subtle UI indication for revised subtitles and record revision status in session history.
- [ ] 8.5 Prepare a PR description focused only on subtitle correction behavior.

## 9. PR 9 - Floating Caption Window

- [ ] 9.1 Implement a separate floating caption window that can stay visible above other applications.
- [ ] 9.2 Add controls to open, close, resize, and reposition the floating caption window.
- [ ] 9.3 Stream current translated subtitle and basic session status into the floating window.
- [ ] 9.4 Verify floating captions remain usable while the user focuses a browser, meeting app, or media player.
- [ ] 9.5 Prepare a PR description focused only on floating caption experience.

## 10. PR 10 - Optional TTS Output

- [ ] 10.1 Add a feature flag or setting for translated speech output.
- [ ] 10.2 Implement TTS generation for translated segments after subtitle output is stable.
- [ ] 10.3 Add playback queue handling, pause/stop controls, and visible TTS status.
- [ ] 10.4 Verify TTS can be disabled without affecting subtitles.
- [ ] 10.5 Prepare a PR description focused only on optional TTS.

## 11. PR 11 - README, Demo, and Review Deliverables

- [ ] 11.1 Expand README in Chinese with project purpose, feature list, setup, API key configuration, run commands, and troubleshooting.
- [ ] 11.2 Document third-party frameworks, libraries, APIs, and original project functionality.
- [ ] 11.3 Add demo script or demo notes covering system audio, file simulation, English to Chinese, Chinese to English, and subtitle correction.
- [ ] 11.4 Add or link the demo video deliverable according to coursework requirements.
- [ ] 11.5 Prepare a PR description focused only on documentation and demo readiness.

## 12. PR 12 - Final Verification and Submission Hygiene

- [ ] 12.1 Run the documented verification commands and confirm the app starts from a clean checkout.
- [ ] 12.2 Check Git history, PR descriptions, commit timing, README completeness, and dependency attribution against the review requirements.
- [ ] 12.3 Confirm no secrets, local-only paths, or generated junk files are committed.
- [ ] 12.4 Push the final `main` state and confirm the public GitHub repository is accessible after the allowed deadline.
- [ ] 12.5 Prepare a final PR or release note summarizing the completed demo state.
