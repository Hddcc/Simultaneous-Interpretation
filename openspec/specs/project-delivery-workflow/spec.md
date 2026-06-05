## Purpose

Define repository, PR, README, demo, dependency attribution, and submission hygiene requirements for the coursework delivery workflow.

## Requirements

### Requirement: Initialize and connect Git repository
The project MUST initialize Git locally, use `main` as the primary branch, connect to the existing GitHub remote, and push the initial project state.

#### Scenario: Repository initialized
- **WHEN** the first implementation task is applied
- **THEN** the repository has Git initialized, a `main` branch, and a remote named `origin` pointing to `https://github.com/Hddcc/Simultaneous-Interpretation.git`

### Requirement: Implement through PR-sized work units
The project MUST split implementation into separate PR-sized tasks where each PR implements or modifies one functional slice.

#### Scenario: Apply cycle starts for one PR
- **WHEN** a developer starts an apply cycle
- **THEN** the selected task group corresponds to one intended PR and does not require implementing unrelated later PR groups

#### Scenario: PR is prepared
- **WHEN** a task group is completed
- **THEN** the branch contains one coherent feature or documentation change that can be described and reviewed independently

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
The project MUST provide a README and demo video or demo instructions suitable for coursework review.

#### Scenario: Reviewer opens README
- **WHEN** a reviewer opens the repository after the submission deadline
- **THEN** the README explains project purpose, setup, API key configuration, run commands, core features, dependency attribution, and original implementation highlights

### Requirement: Maintain Chinese README documentation
The project MUST write README content and future README updates in Chinese, while preserving commands, code paths, dependency names, API names, and environment variables in their original form.

#### Scenario: README updated in later PR
- **WHEN** a later PR changes README content
- **THEN** the new README prose is written in Chinese and technical identifiers remain accurate

### Requirement: Attribute third-party dependencies
The project MUST list third-party libraries, frameworks, APIs, and reused code sources in README or dedicated documentation.

#### Scenario: Dependency list reviewed
- **WHEN** reviewers inspect dependency documentation
- **THEN** they can distinguish third-party components from original project functionality
