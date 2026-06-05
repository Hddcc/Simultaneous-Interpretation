## Context

The project starts from an empty repository with OpenSpec configuration only. The target product is a desktop AI simultaneous interpretation assistant for users watching courses, meetings, calls, videos, or technical talks in different applications. The first version must prioritize a runnable demo, clear README documentation, continuous Git/PR history, and a workflow that can be implemented through multiple small apply cycles.

The primary user environment is a desktop computer where the desired source audio is often the computer's own playback audio. The application also needs microphone capture and local file simulation so it can support fallback usage and repeatable demos.

## Goals / Non-Goals

**Goals:**

- Build a desktop application that captures audio from system playback, microphone input, and local files.
- Provide low-latency English to Chinese and Chinese to English interpretation as real-time subtitles.
- Allow recent subtitles to be revised in place when ASR or translation output improves.
- Keep language direction handling extensible for future languages.
- Provide a polished workbench UI and floating caption window suitable for meetings, online courses, and calls.
- Treat Git initialization, PR splitting, README, demo video, and dependency attribution as first-class delivery work.

**Non-Goals:**

- Full offline ASR, translation, or TTS model hosting in the first version.
- Perfect simultaneous interpretation quality for every accent, domain, or noisy environment.
- Mobile app support.
- Multi-speaker diarization as a required first-version feature.
- Production billing, account management, or team collaboration.

## Decisions

### Desktop Shell

Use Electron, React, and TypeScript for the first version. Electron gives the project a practical path to system audio and desktop source capture through Chromium/Electron APIs, while React and TypeScript make the UI and streaming state easier to structure for a coursework demo.

Alternative considered: Tauri. Tauri is attractive for smaller bundles and a stronger native security model, but system audio capture often requires more native integration work. It remains a possible later migration after the MVP is stable.

### Audio Input Architecture

Create an audio ingestion layer with a common normalized stream interface:

```text
AudioSource -> AudioNormalizer -> ChunkBuffer -> InterpretationPipeline
```

Each source adapter MUST emit normalized audio chunks plus metadata such as source type, timestamp, and stream status. This keeps system audio, microphone audio, and file simulation interchangeable after capture.

### AI Pipeline

Use a staged streaming pipeline:

```text
Audio chunks -> ASR partial/final text -> translation -> subtitle event -> optional TTS
```

The pipeline MUST model partial and final ASR events separately. Translation should receive recent context so technical terms and sentence continuations can be translated more consistently. TTS is placed after subtitle stability because spoken output introduces additional delay and correction challenges.

### Revision Model

Subtitles MUST be represented as versioned segments:

```text
segment_id
source_text
translated_text
status: partial | final | revised
revision
start_time
end_time
```

When better ASR or translation output arrives, the UI updates the existing segment by `segment_id`. This makes correction visible without duplicating the same utterance as multiple subtitle lines.

### Language Direction Model

The first version supports English to Chinese and Chinese to English. Language configuration MUST use a structured `LanguagePair` model so future languages can be added through configuration, prompts, and service mapping rather than a rewrite of the pipeline.

### UI Structure

Use a work-focused desktop interface:

- top control bar for audio source, language direction, start/pause, and service status;
- central live subtitle region with original and translated text;
- right panel for history, revisions, and glossary;
- bottom strip for waveform, latency, ASR state, translation queue, and optional TTS state;
- independent floating caption window that can stay above other apps.

The UI should use professional tool styling: strong readability, stable controls, accessible contrast, visible loading states, keyboard-friendly controls, and restrained animation.

### Delivery Workflow

Tasks MUST be split by PR. Each PR should add or modify a single functional slice, include a clear PR description, and remain runnable after merge. The tasks file will list PR-sized task groups so `/opsx:apply` can be run multiple times without bundling the whole project into one final PR.

## Risks / Trade-offs

- System audio capture varies across operating systems and device configurations -> prioritize Windows system playback for the first demo, provide microphone and file simulation fallback, and document limitations.
- Short audio chunks reduce latency but can hurt recognition and translation quality -> use chunk buffering, VAD, and recent context windows.
- Frequent subtitle revisions can distract users -> only revise recent segments and use subtle visual states.
- TTS can conflict with corrected subtitles after audio has already played -> treat TTS as optional enhancement after subtitle flow.
- External AI APIs introduce cost, latency, and network risk -> use `.env.example`, configurable providers, and clear README setup.
- Last-minute bulk commits could violate review expectations -> make Git initialization and PR discipline explicit tasks from the first implementation cycle.

## Migration Plan

1. Initialize the Git repository and connect the existing GitHub remote.
2. Create the desktop project scaffold on a first feature branch.
3. Implement each capability through small PR-sized apply cycles.
4. Keep `main` runnable after each merge.
5. Add README, demo assets, and dependency attribution before final submission.

Rollback for each implementation PR is a standard Git revert of that PR. No data migration is expected in the MVP.

## Open Questions

- Which AI provider and model set will be used for the first implementation?
- Which Windows system audio capture method is most reliable in the target development environment?
- Should the first demo emphasize subtitle-only interpretation or include optional TTS?
- What demo source material will be used to show English to Chinese and Chinese to English translation?
