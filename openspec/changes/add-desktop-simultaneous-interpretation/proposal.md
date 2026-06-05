## Why

Users often need to follow English or other foreign-language talks, technical sharing sessions, international meetings, online courses, and calls across different desktop applications. A desktop AI simultaneous interpretation assistant can capture computer audio once and present real-time Chinese or English subtitles, lowering the language barrier and helping users keep pace with the original content.

The project must also satisfy coursework review expectations: public repository access after the deadline, continuous PR and commit records during the development period, a runnable demo, complete README documentation, and clear attribution for third-party libraries and APIs.

## What Changes

- Add a desktop application for real-time AI simultaneous interpretation.
- Support multiple audio input modes:
  - computer/system audio as the primary use case;
  - microphone capture as a fallback and meeting-room mode;
  - local audio/video file playback that simulates real-time input for demos and tests.
- Add a streaming ASR -> translation -> subtitle pipeline for English to Chinese and Chinese to English.
- Add a revision-aware subtitle model that can update recent recognition or translation results when better context becomes available.
- Add extension points for future source and target languages.
- Add a desktop UI with a main workbench, floating caption window, session history, source controls, language controls, and status indicators.
- Add optional text-to-speech output as an enhancement after the subtitle workflow is stable.
- Add repository delivery workflow tasks so each PR is implemented and reviewed as a separate apply cycle.
- Keep README documentation and future README updates written in Chinese, while preserving command names, API names, environment variables, and code paths in their original form.

## Capabilities

### New Capabilities

- `desktop-audio-ingestion`: Captures desktop audio, microphone audio, and real-time simulated file playback as normalized streaming audio input.
- `realtime-interpretation-pipeline`: Converts incoming audio into source text, translates it between English and Chinese, and emits low-latency interpretation events.
- `revision-aware-subtitles`: Displays subtitles that can be corrected in place when ASR or translation results are revised.
- `language-direction-management`: Manages source and target language configuration with an extensible model for future languages.
- `desktop-caption-experience`: Provides the main desktop workbench and floating caption window for real-time viewing during meetings, courses, calls, and media playback.
- `project-delivery-workflow`: Defines Git, PR, README, demo, and dependency documentation requirements as first-class project tasks.

### Modified Capabilities

- None.

## Impact

- Adds a new desktop application codebase, likely using Electron, React, and TypeScript for the first version.
- Adds an AI service integration layer for ASR, translation, and optional TTS.
- Adds audio capture, buffering, segmentation, and status reporting logic.
- Adds UI state models for streaming subtitles, revised subtitles, sessions, language pairs, audio source selection, and service health.
- Adds GitHub-oriented delivery artifacts such as README, PR template, `.gitignore`, `.env.example`, and demo documentation.
- Requires Chinese README documentation for project setup, usage, demo, dependency attribution, and future README updates.
- Requires secure API key handling through environment configuration and explicit README setup instructions.
