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
