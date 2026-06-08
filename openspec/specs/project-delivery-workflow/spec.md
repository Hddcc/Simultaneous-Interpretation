## Purpose

Define repository, PR, README, demo, dependency attribution, and submission hygiene requirements for the coursework delivery workflow.
## Requirements
### Requirement: Initialize and connect Git repository
The project MUST initialize Git locally, use `main` as the primary branch, connect to the existing GitHub remote, and push the initial project state.

#### Scenario: Repository initialized
- **WHEN** the first implementation task is applied
- **THEN** the repository has Git initialized, a `main` branch, and a remote named `origin` pointing to `https://github.com/Hddcc/Simultaneous-Interpretation.git`

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

### Requirement: Keep main branch runnable
The project MUST keep the `main` branch in a runnable state after each PR merge.

#### Scenario: PR merges into main
- **WHEN** a PR is merged into `main`
- **THEN** the documented development command or verification command can reproduce the current app state

### Requirement: Document PR content clearly
Each PR MUST have a title and description that state the feature change, usage, implementation approach, and verification method.

#### Scenario: PR description reviewed
- **WHEN** reviewers inspect a PR
- **THEN** they can identify what changed, how to use it, how it was implemented, and how it was tested

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

### Requirement: Attribute third-party dependencies
The project MUST list third-party libraries, frameworks, APIs, and reused code sources in README or dedicated documentation.

#### Scenario: Dependency list reviewed
- **WHEN** reviewers inspect dependency documentation
- **THEN** they can distinguish third-party components from original project functionality

### Requirement: Verify complete live interpretation before final archive
The project MUST run and record final verification for live system audio, microphone fallback, provider-backed ASR, provider-backed translation, subtitle revision, floating captions, README accuracy, and secret hygiene before archiving the change.

#### Scenario: Final verification is performed
- **WHEN** the complete realtime change is ready to archive
- **THEN** verification evidence covers build, OpenSpec validation, live scenario testing, provider configuration checks, and GitHub public repository status
