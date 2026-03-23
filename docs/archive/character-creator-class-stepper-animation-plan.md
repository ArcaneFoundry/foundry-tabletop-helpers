# Character Creator Class Stepper Animation Plan

## Purpose

This document outlines the implementation plan for a richer Character Creator stepper that treats `Class` as an aggregate milestone with animated sub-selections.

The initial scope is intentionally limited to the `Class` stage only. We are not redesigning the entire wizard stepper in one pass. We are building the data model, animation choreography, and component structure needed to support:

- a main `Class` circle
- animated sub-icons that appear around the `Class` circle when follow-up class selections become relevant
- stateful transitions as the user completes class-related selections
- subdued treatment for steps that will be skipped

The first concrete user journey to optimize is:

1. choose a class
2. confirm and move forward
3. show class-related child selections around the main class node
4. complete those selections one by one
5. collapse those child selections back into the main class node when the class section is fully done


## Current State

Today there are two different progress UIs:

- the class page uses a local `ProgressRail` in [class-step-screen.tsx](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/react/steps/class/class-step-screen.tsx)
- the shell uses the global wizard step nav in [wizard-shell.tsx](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/react/components/wizard-shell.tsx)

Wizard step status is currently driven by:

- [wizard-state-machine.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/wizard/wizard-state-machine.ts)
- [wizard-state-machine-helpers.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/wizard/wizard-state-machine-helpers.ts)

The current state model knows about:

- `pending`
- `complete`
- `invalid`
- `active`

It does not yet know about:

- aggregate step groups like `class`
- child milestones like `skills` or `weapon masteries`
- visual-only transition states like `just-completed`, `in-progress`, or `will-skip`


## Scope For This Feature

### In Scope

- Introduce an aggregate `Class` progress node with child selection satellites
- Support animated class-subtask reveal after class confirmation
- Support per-child completion animations
- Support aggregate `Class` completion animation when leaving the class section
- Support subdued styling for steps that are known to be skipped
- Build a reusable state contract that can later power other grouped sections

### Out Of Scope

- Reworking the full wizard information architecture
- Adding every possible class-dependent selection immediately
- Redesigning origin/species/background groups in the same slice
- Replacing all current stepper UIs in one shot


## Product Model

For the first implementation, `Class` becomes a grouped milestone.

### Main Node

- `Class`

### Child Satellites In First Pass

- `Skills`
- `Weapon Masteries`

These two are the best first-pass children because they already exist as distinct downstream steps in the current flow:

- [step-class-choices.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-class-choices.ts)
- [step-weapon-masteries.ts](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/steps/step-weapon-masteries.ts)

### Future Child Satellites

Do not ship these in the first pass, but the data model should allow for them later:

- tools
- expertise
- class-specific special choices
- spell selections if we later decide they belong under the same visual family


## Live Class Content Notes

From the installed `dnd-players-handbook.classes` compendium on the live Foundry server:

- all classes have class skill choices
- some classes also have level 1 weapon mastery choices
- Bard and Monk have tool choices at level 1
- Rogue has extra level 1 choice-like behavior such as expertise and a `Thieves' Cant` language-style advancement

For this plan, we will still start with only:

- `Skills`
- `Weapon Masteries`

Reason:

- both already map to explicit current wizard steps
- both are highly legible to players
- both fit the visual metaphor cleanly
- tools and expertise can be layered into the same system later without changing the core architecture


## UX Behavior

### 1. Landing On Class

The main `Class` node appears as it does now:

- neutral pending state
- no child satellites visible

### 2. Selecting A Class

When a class card is selected but not yet confirmed:

- the main `Class` node enters a `selection-active` preview state
- subtle internal glow pulses while the user can still change their mind
- no children appear yet

Reason:

- card selection should feel live
- but child nodes should not imply commitment until the user advances

### 3. Confirming Class And Moving Forward

When the user clicks `Next` from the class step:

- animate the main `Class` node to `in-progress`
- fill the circle with the section accent color
- trigger a soft glow burst, then let it settle
- animate in child satellites around the main node
- satellites should feel as if they emerge from the main node, not just fade in separately

For first pass:

- `Skills` icon pops out
- `Weapon Masteries` icon pops out when applicable for the chosen class

If a chosen class does not need weapon masteries:

- do not spawn that child node

### 4. Completing A Child Selection

When the user completes the `Skills` step and moves on:

- animate the `Skills` child node fill to `complete`
- trigger a brief soft glow
- let the glow settle to a quieter completed state

Same behavior for `Weapon Masteries`.

### 5. Leaving The Class Section

When the user finishes the final visible class child step and transitions out of the class group:

- child satellites slide inward toward the main `Class` node
- child satellites scale down and merge visually into the main node
- main `Class` node fills to `complete`
- main node glow becomes quieter and more stable

This should read as:

- “all class-related setup is now absorbed into the class milestone”

### 6. Skipped Steps

If a step is known to be skipped because of prior selections:

- use a muted, low-contrast fill
- reduce ornament intensity
- remove active glow language

Skipped should read as:

- resolved
- not failed
- not interactive


## Recommended State Model

We should not overload the existing raw wizard step statuses with every animation concern.

Instead, introduce a second derived presentation layer.

### Wizard Truth State

Keep current machine truth:

- `pending`
- `complete`
- `invalid`
- `active`

### Stepper Presentation State

Derive richer UI states for rendering:

- `locked`
- `pending`
- `selection-active`
- `in-progress`
- `complete`
- `skipped`
- `invalid`
- `collapsed-complete`

### Group Node Shape

Proposed TypeScript shape:

```ts
type StepperGroupNode = {
  id: string;
  label: string;
  icon: string;
  status:
    | "locked"
    | "pending"
    | "selection-active"
    | "in-progress"
    | "complete"
    | "skipped"
    | "invalid"
    | "collapsed-complete";
  active: boolean;
  children: StepperChildNode[];
  accentTone: "forge" | "arcane" | "nature" | "gold";
  animationKey: number;
};

type StepperChildNode = {
  id: string;
  label: string;
  icon: string;
  status: "hidden" | "pending" | "active" | "complete" | "skipped";
  visible: boolean;
  completionOrder: number;
};
```

### Important Rule

`animationKey` should be driven by significant state transitions, not by every render. That gives us a stable way to trigger one-shot Motion sequences only when the milestone meaning actually changes.


## How To Derive Class Group Data

Add a new helper that derives a grouped stepper model from the wizard state and current class selection.

Suggested new module:

- `src/character-creator/react/progress/build-aggregate-stepper-model.ts`

### Inputs

- current `WizardState`
- applicable steps
- current step id
- class selection data
- class-dependent applicability for:
  - skills
  - weapon masteries

### Outputs

- one aggregate `Class` group node
- standard top-level nodes for later sections
- child nodes visible only when relevant

### First-Pass Derivation Rules

Main `Class` node:

- `pending` before any class selection
- `selection-active` when a class has been selected on the class screen but the user is still on that screen
- `in-progress` after leaving the class step and while any class child steps remain unresolved
- `collapsed-complete` once all class-child steps that apply have completed and the user moves into the next major section

Child node visibility:

- `Skills` visible if class skills are required
- `Weapon Masteries` visible only if `state.selections.class?.hasWeaponMastery` is true

Child status:

- `pending` until completed
- `active` if currently on that step
- `complete` once the step is done
- `hidden` before the main class commit animation


## Component Architecture

### Recommended Direction

Build a new reusable progress component rather than forcing this behavior into the existing plain shell nav.

Suggested components:

- `AggregateStepper`
- `AggregateStepperNode`
- `AggregateStepperChildSatellite`
- `AggregateStepperConnector`

Suggested location:

- `src/character-creator/react/components/progress/`

### Why Not Patch The Existing Shell Nav Directly

The current shell nav in [wizard-shell.tsx](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/react/components/wizard-shell.tsx) is linear and button-oriented.

This feature needs:

- grouped nodes
- nested animation timing
- child orbit layout
- transition memory between screens

That is easier to build cleanly as a dedicated component fed by a derived model.

### First Rollout Target

Replace the local class `ProgressRail` in [class-step-screen.tsx](/Users/johngallego/CodeProjects/foundry-tabletop-helpers/src/character-creator/react/steps/class/class-step-screen.tsx) first.

After it works there, decide whether to:

- reuse it in the shell globally
- or keep a premium local variant for the class flow only


## Animation Design

Use Motion for all major transitions. Favor spring-based animation for emergence and completion, and opacity/color interpolation for fill state changes.

### Main Node Animations

#### Pending -> Selection Active

- slight scale bloom
- gentle inner glow pulse
- no child reveal yet

#### Selection Active -> In Progress

- circle fill sweep from neutral to section accent
- quick center glow bloom
- glow settles instead of blinking out abruptly

#### In Progress -> Collapsed Complete

- child nodes converge inward
- main fill color deepens to completed tone
- glow becomes smaller and steadier

### Child Satellite Enter

When revealed:

- start at main node center
- scale from `0.6` to `1.05` to `1`
- travel outward to final orbital slot
- short opacity ramp

This should feel like:

- “the class choice has unfolded new obligations”

### Child Satellite Complete

- fill color transition
- soft radial glow
- glow fades to resting completed state

### Child Satellite Collapse

- move back toward center
- shrink slightly
- opacity fade during merge

### Skipped Animation

Do not make skipped steps flashy.

Use:

- brief desaturation fade
- very soft fill settle
- no celebratory glow


## Geometry And Layout

### Main Node

- retain current circle scale as baseline

### Child Orbit

First pass should use fixed orbital positions relative to the main node:

- `Skills`: upper-right or right
- `Weapon Masteries`: lower-right or lower-left depending on visual balance

Keep the geometry shallow and readable. These should feel attached, not like a second row.

### Responsive Rule

On narrower widths:

- reduce orbit distance
- reduce child node size slightly
- if needed, allow a compact horizontal cluster instead of a full circular orbit


## Transition Trigger Strategy

This feature depends on cross-screen animation continuity. The critical requirement is that the stepper knows not only current state, but also the previous rendered state.

### Recommended Approach

Keep a presentation-state cache in the React layer.

Suggested location:

- wizard controller snapshot layer or a small React context owned by the shell

### Why

The stepper needs to know:

- “a class was just confirmed”
- “skills just completed”
- “weapon masteries just completed”
- “the class group just resolved”

That is not captured by static `complete` vs `pending` alone.

### Proposed Mechanism

1. Build current derived stepper model from wizard state.
2. Compare it to the previous derived model.
3. Generate transition intents, such as:
   - `class_committed`
   - `child_revealed: skills`
   - `child_completed: skills`
   - `group_collapsed: class`
4. Feed those intents into Motion variants or one-shot keyed sequences.


## Technical Implementation Steps

### Phase 1: Data Contract

1. Add a derived aggregate-stepper builder.
2. Define group and child node types.
3. Add class-group derivation for:
   - class
   - skills
   - weapon masteries
4. Add `skipped` derivation support for future use.

### Phase 2: Dedicated Component

1. Build a new `AggregateStepper` React component.
2. Render:
   - main grouped node
   - child satellites
   - connector ornamentation
3. Keep styling in Tailwind.
4. Keep Foundry-safe motion and reduced-motion support.

### Phase 3: Animation Memory

1. Add previous-model tracking in React.
2. Derive transition intents from old vs new model.
3. Key Motion sequences off those intents.
4. Prevent repeated intro animations on harmless rerenders.

### Phase 4: First Integration

1. Replace the class page `ProgressRail` with `AggregateStepper`.
2. Keep other pages unchanged initially.
3. Ensure class-step state updates trigger:
   - selection-active preview on class card selection
   - in-progress state after `Next`
   - child completion states on downstream steps

### Phase 5: Completion Collapse

1. Detect the moment the user leaves the class family.
2. Trigger child collapse animation.
3. Persist completed aggregate state on later pages.

### Phase 6: Skipped States

1. Identify skipped steps from applicability logic.
2. Render muted skipped treatment.
3. Verify it never looks like an error state.


## Validation Plan

### Local

- unit test aggregate-stepper model derivation
- test child visibility for classes with and without weapon masteries
- test transition intent generation
- test reduced-motion fallback

### Live Foundry

Verify at minimum:

1. Fighter:
   - class selected
   - class confirmed
   - skills child appears
   - weapon mastery child appears
   - both complete correctly
   - collapse into completed class node

2. Wizard:
   - class selected
   - class confirmed
   - skills child appears
   - weapon mastery child does not appear
   - class group resolves cleanly after skills

3. Narrow window:
   - child orbit remains legible
   - no clipping
   - no overlap with title or header flourishes


## Risks

### 1. Too Much Motion Noise

If every state transition glows and pops strongly, the stepper will start competing with the main page content.

Mitigation:

- make glows short-lived
- keep child entrance elegant rather than explosive
- reserve the strongest accent for true completion events

### 2. Cross-Screen Animation Breakage

If the stepper remounts without state memory, the child orbit will replay incorrectly or feel disconnected from the transition.

Mitigation:

- keep previous rendered model in shell-level React state
- use keyed transitions only when actual state meaning changes

### 3. Applicability Drift

Some classes have other level 1 choices in live PHB content, but the first pass only surfaces skills and weapon masteries.

Mitigation:

- document that this is a deliberate first-pass simplification
- keep the group-node model extensible for future tool/expertise children


## Recommendation

Ship this in a narrow vertical slice:

1. build aggregate model
2. implement class main node + skills satellite
3. add weapon mastery satellite
4. add collapse behavior
5. only then consider expanding to tool or expertise satellites

That order gives us the emotional payoff of the feature early, while keeping the implementation grounded in the existing class flow instead of trying to solve every class-specific edge case at once.
