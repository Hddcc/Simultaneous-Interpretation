## ADDED Requirements

### Requirement: Maintain stable live caption geometry
The system SHALL render the main bilingual active cue in bounded source and translation slots with a stable reading anchor while preserving the complete cue text for history.

#### Scenario: Active cue text grows across lines
- **WHEN** source or translated text for the same active cue grows from one line to multiple lines while the viewport and font preference remain unchanged
- **THEN** the source ending-line anchor and translation starting-line anchor remain within one CSS pixel of their previous vertical positions after layout settles

#### Scenario: Active cue is revised in place
- **WHEN** ASR finalization, translation completion, or refinement replaces text for the same active cue
- **THEN** the main caption updates the text in its existing slots without moving the stable reading anchor or appending a duplicate line

#### Scenario: Recent context count changes
- **WHEN** recent context changes between zero and the supported maximum number of entries
- **THEN** the active source and translation slot positions remain unchanged

#### Scenario: Active cue exceeds visible slot bounds
- **WHEN** source or translated text exceeds the visible line capacity of its slot
- **THEN** the main caption applies a bounded line limit and hidden overflow without a visible scrollbar, overlap, or mutation of the complete text stored for history

#### Scenario: Caption viewport or font preference changes
- **WHEN** the user resizes the main window or selects another supported subtitle font size
- **THEN** the caption slots recompute for the new layout and remain stable for subsequent cue revisions without horizontal overflow or incoherent overlap
