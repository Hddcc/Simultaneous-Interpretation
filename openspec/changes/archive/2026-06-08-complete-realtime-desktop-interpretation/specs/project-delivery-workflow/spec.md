## MODIFIED Requirements

### Requirement: Implement through PR-sized work units
The project MUST split implementation into separate PR-sized tasks where each PR implements or modifies one functional slice, with the complete realtime interpretation work delivered through multiple apply cycles.

#### Scenario: Apply cycle starts for one PR
- **WHEN** a developer starts an apply cycle
- **THEN** the selected task group corresponds to one intended PR and does not require implementing unrelated later PR groups

#### Scenario: PR is prepared
- **WHEN** a task group is completed
- **THEN** the branch contains one coherent feature or documentation change that can be described and reviewed independently

#### Scenario: Realtime work is split
- **WHEN** native capture, provider sessions, translation, scenario QA, and README updates are implemented
- **THEN** each concern is delivered in a separate PR-sized task group

### Requirement: Provide README and demo deliverables
The project MUST provide a README and demo video or demo instructions suitable for coursework review, with README written as a Chinese product usage guide.

#### Scenario: Reviewer opens README
- **WHEN** a reviewer opens the repository after the submission deadline
- **THEN** the README explains project purpose, setup, API key configuration, run commands, core features, dependency attribution, original implementation highlights, supported live scenarios, and known limitations

### Requirement: Maintain Chinese README documentation
The project MUST write README content and future README updates in Chinese product-usage style, while preserving commands, code paths, dependency names, API names, and environment variables in their original form.

#### Scenario: README updated in later PR
- **WHEN** a later PR changes README content
- **THEN** the new README prose is written in Chinese, technical identifiers remain accurate, and internal PR numbers or private submission checklist wording are not presented as product content

## ADDED Requirements

### Requirement: Verify complete live interpretation before final archive
The project MUST run and record final verification for live system audio, microphone fallback, provider-backed ASR, provider-backed translation, subtitle revision, floating captions, README accuracy, and secret hygiene before archiving the change.

#### Scenario: Final verification is performed
- **WHEN** the complete realtime change is ready to archive
- **THEN** verification evidence covers build, OpenSpec validation, live scenario testing, provider configuration checks, and GitHub public repository status
