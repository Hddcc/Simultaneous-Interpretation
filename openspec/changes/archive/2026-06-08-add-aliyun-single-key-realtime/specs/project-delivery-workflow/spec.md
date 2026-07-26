## MODIFIED Requirements

### Requirement: Provide README and demo deliverables
The project MUST provide a README and demo video or demo instructions suitable for coursework review, with README written as a Chinese product usage guide and with the Aliyun one-key real-use path documented as the simplest real provider setup.

#### Scenario: Reviewer opens README
- **WHEN** a reviewer opens the repository after the submission deadline
- **THEN** the README explains project purpose, setup, API key configuration, run commands, core features, dependency attribution, original implementation highlights, supported live scenarios, and known limitations

#### Scenario: User wants the fewest keys
- **WHEN** a user wants real realtime interpretation with minimal provider setup
- **THEN** the README shows how to configure `DASHSCOPE_API_KEY` once for both `fun-asr-realtime` ASR and Qwen translation

### Requirement: Maintain Chinese README documentation
The project MUST write README content and future README updates in Chinese product-usage style, while preserving commands, code paths, dependency names, API names, and environment variables in their original form.

#### Scenario: README updated in later PR
- **WHEN** a later PR changes README content
- **THEN** the new README prose is written in Chinese, technical identifiers remain accurate, and internal PR numbers or private submission checklist wording are not presented as product content

#### Scenario: Aliyun setup is documented
- **WHEN** README describes Aliyun setup
- **THEN** it explains that the Model Studio API key is selected by model name at request time and that users should not commit the key

### Requirement: Verify complete live interpretation before final archive
The project MUST run and record final verification for live system audio, microphone fallback, provider-backed ASR, provider-backed translation, subtitle revision, floating captions, README accuracy, and secret hygiene before archiving the change.

#### Scenario: Final verification is performed
- **WHEN** the complete realtime change is ready to archive
- **THEN** verification evidence covers build, OpenSpec validation, live scenario testing, provider configuration checks, and GitHub public repository status

#### Scenario: Aliyun one-key verification is performed
- **WHEN** the Aliyun single-key path is implemented
- **THEN** verification evidence covers missing-key behavior, provider health, ASR event parsing, Qwen translation, and secret hygiene for `DASHSCOPE_API_KEY`
