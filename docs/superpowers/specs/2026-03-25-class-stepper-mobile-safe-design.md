# Issue #22: Class Stepper Mobile-Safe Design

## Summary

Issue `#22` will make the class-selection stepper inside Character Creation adapt cleanly to narrow Foundry window widths without losing progress clarity.

The current stepper assumes a single wide horizontal rail. On narrow windows, that creates cramped labels and weak readability. The design for this issue preserves the existing wide-screen presentation, but introduces a deliberate compact mode that wraps the four chapter milestones into two rows, reduces visual density slightly, and hides substep chips entirely while space is constrained.

This work is limited to the class chapter progress chrome. It does not change wizard mechanics, aggregate-stepper state computation, or non-class chapters.

## Goals

- Keep all four main chapter milestones visible in narrow Character Creation windows.
- Preserve clear active, complete, pending, and invalid states in both wide and compact layouts.
- Make the compact mode feel designed, not like accidental wrapping.
- Drive the layout from available container width rather than viewport assumptions.

## Non-Goals

- Redesigning the stepper data model or milestone sequencing.
- Changing non-class chapter progress UI.
- Keeping substep chips visible in narrow mode.
- Introducing a separate mobile-only stepper component unless the existing component proves too rigid.

## Current State

The current `ClassAggregateStepper` in `src/character-creator/react/steps/class/class-step-screen.tsx` renders:

- one centered horizontal milestone rail
- milestone nodes with full labels
- fixed connectors between milestones
- optional wrapped substep chips below the rail

This works at medium and wide widths, but it still depends on a desktop-like inline footprint. The surrounding creator shell already uses container-aware styling, so the stepper is the main remaining first-view element that does not collapse gracefully.

## Proposed Interaction Model

### Wide Mode

At comfortable widths, preserve the current stepper treatment:

- single-row milestone rail
- connector lines between milestones
- full-size milestone icon and label sizing
- substep chips visible when the class flow is inside deeper class panes

This avoids unnecessary visual churn in the layout that already works.

### Compact Mode

At narrow container widths, switch the stepper into a compact, wrapped presentation:

- all four main milestones remain visible
- milestones wrap into two rows
- milestone icon size, label size, gaps, and vertical padding reduce slightly
- connector treatment simplifies so it still reads as progress without looking broken when wrapping
- substep chips are hidden entirely

This keeps the stepper readable and stable while accepting the vertical tradeoff as the better outcome inside a narrow window.

## Architecture

The implementation should stay inside the current `ClassAggregateStepper` component rather than splitting into parallel wide/mobile components.

### Component Responsibilities

`ClassAggregateStepper` remains responsible for:

- rendering milestone nodes from the existing aggregate-stepper model
- rendering optional substeps
- exposing enough structural hooks for wide and compact presentations

The aggregate-stepper model remains unchanged. This is presentation work only.

### Styling Strategy

Use container-width-driven behavior so the stepper responds to the actual Character Creation window size.

Likely split:

- structure and conditional rendering in `class-step-screen.tsx`
- compact-mode layout and sizing rules in `src/character-creator/styles/character-creator-wizard.css`

The compact mode should be activated by a container-aware CSS breakpoint or a lightweight structural hook that CSS can target. Avoid viewport-only logic.

## Layout Details

### Milestones

In compact mode:

- milestone nodes should remain visually grouped with their labels
- labels should stay readable, not reduced to cryptic abbreviations
- icon and label sizing should shrink slightly, not collapse aggressively
- alignment should feel intentional when milestones wrap into two rows

### Connectors

The current connector line works best in a single row. In compact mode, connectors should be simplified rather than forced into a broken geometry. Acceptable treatments include:

- shorter inline connectors that only appear where the row layout still supports them
- softer decorative separators
- reduced-emphasis connector treatment that supports the milestone grouping without implying a rigid one-line rail

The goal is continuity, not literal diagrammatic precision at tiny widths.

### Substeps

Substep chips should hide completely in compact mode. This keeps the compact stepper focused on the main chapter progression and avoids consuming too much vertical space after wrapping.

## Risks

### Risk: Compact mode feels like accidental wrap

If the component only allows wrapping without adjusting spacing, sizing, and connector treatment, the result will feel broken rather than mobile-safe.

Mitigation:

- explicitly tune compact gaps, label sizing, and node sizing
- simplify connector treatment rather than reusing the exact desktop rail

### Risk: State clarity drops in compact mode

If the labels or icon treatments shrink too far, active and completed milestones may become harder to distinguish.

Mitigation:

- preserve the current status color and glow language
- reduce only size and spacing, not semantic state affordances

### Risk: Compact mode breakpoint is tied to the viewport instead of the app

Because Character Creation runs in a resizable Foundry window, viewport breakpoints can misrepresent the available inline space.

Mitigation:

- drive the change from container width or app-local layout width

## Verification Strategy

### Local

- Add focused tests for `ClassAggregateStepper` or closely related rendering seams.
- Verify compact mode hides substeps while preserving milestone visibility.
- Verify the wide mode still renders the existing full rail treatment.
- Run targeted tests and typecheck.

### Live Foundry

Deploy to the Foundry host and verify the Character Creation class stepper at:

- narrow/mobile-sized width
- medium width
- wide desktop-sized width

Acceptance checks:

- all four milestones remain visible in compact mode
- milestone labels remain readable
- active and completed states remain clear
- substeps are hidden in compact mode
- wide mode still presents the full single-row rail
- transitions between modes feel intentional

## Acceptance Mapping

This design satisfies the issue acceptance criteria by:

- removing dependence on a single wide horizontal rail
- preserving main milestone clarity at narrow widths
- using container-aware responsiveness
- verifying behavior in live window resizing, not just static inspection
