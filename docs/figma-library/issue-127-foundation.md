# Issue 127: Figma Library Foundation for Parchment / Abyssal

## Status

Blocked from completing the actual Figma library in this session because the available Figma connector only exposes inspection and generation helpers. There is no write-capable Figma canvas/file tool and no Figma file key or node id supplied in the task context.

This document is the concrete handoff for the library build. It translates the shipped codebase tokens and component language into a Figma library plan, without redesigning the system.

## Source Of Truth

Use these files as the canonical references for the library:

- `src/ui/styles/design-tokens.css`
- `src/ui/styles/tailwind.css`
- `src/character-creator/styles/character-creator-tokens.css`
- `src/lpcs/styles/lpcs-tokens.css`
- `src/character-creator/react/components/wizard-shell.tsx`
- `src/character-creator/react/steps/class/class-card.tsx`
- `src/character-creator/styles/character-creator-steps.css`

## Library Goals

- Mirror the shipped Parchment / Abyssal language, not reinterpret it.
- Separate shared foundations from feature-specific surfaces.
- Reuse the same semantic token vocabulary used by the app.
- Publish components that match the actual product shell, headers, status pills, cards, and stepper treatment.

## Foundation Tokens To Mirror

### Color

Create shared color styles or variables for:

- Canvas, surface, elevated surface, glass, strong glass, and inset surface
- Border and strong border
- Text, muted text, and subtle text
- Accent, accent-strong, accent-soft, and accent-contrast
- Focus, success, warning, and danger
- Shared special-purpose LP/coin and damage colors from the shared theme layer

### Typography

Mirror the shipped font stack:

- Display: `Newsreader`, `Cinzel`, Georgia, serif
- Body: `Inter`, ui-sans-serif, system-ui, sans-serif
- UI: `Inter`, ui-sans-serif, system-ui, sans-serif

For the character-creator-specific surfaces, also preserve:

- `Cinzel` / `Palatino`-leaning display treatment in the creator token layer
- `Merriweather`-style body treatment used by creator surfaces
- `Inter` utility / UI treatment for controls

### Radius And Spacing

Mirror the shipped radius scale:

- Small, medium, large, hero

Mirror the shipped spacing scale:

- 2xs, xs, sm, md, lg, xl

### Effects

Mirror the shipped panel and selected-state language:

- Panel shadow
- Elevated shadow
- Inset highlight
- Selected ring
- Card chip shadow
- Selected glow

### Theme Surfaces

The Figma library should explicitly model the same surface primitives already used in the app:

- Shell backdrop
- Shell sheen
- Panel
- Panel alt
- Panel header
- Status pill
- Accent line
- Step active / complete / invalid states
- Card shell and inner shell
- Card top fade
- Card chip
- Card selected treatment

## Component Inventory

Build these as the first published library components, in this order:

1. Shell backdrop and sheen
2. Panel and header panel
3. Status pill
4. Stepper item
5. Button set
6. Class card
7. Info chip / badge
8. Wizard header block

## Component Notes

### Wizard Shell

Reference: `src/character-creator/react/components/wizard-shell.tsx`

The library should model the wizard shell as a reusable frame with:

- Header block
- Progress pill
- Horizontal step rail
- Footer action area
- Themed backdrop and sheen

The step labels should reflect the shipped major creator flow:

- Class
- Species
- Background
- Skills
- Abilities
- Spells
- Equipment
- Lore

### Class Card

Reference: `src/character-creator/react/steps/class/class-card.tsx`

This is the highest-value component for the library because it captures the clearest shipped visual language:

- Outer shell gradient
- Inner shell gradient
- Top sheen
- Title treatment
- Corner icon badge
- Bottom info chips
- Selected badge
- Hover and selected elevation behavior

The Figma component should support:

- Default
- Hover
- Selected
- Selected + hover
- Compact / gallery presentation

### Theme Panel Primitives

Reference: `src/ui/styles/tailwind.css`

Model the shared shell primitives as base components or style variables:

- `.fth-theme-shell-backdrop`
- `.fth-theme-shell-sheen`
- `.fth-theme-panel`
- `.fth-theme-panel--alt`
- `.fth-theme-panel--header`
- `.fth-theme-header-glow`
- `.fth-theme-panel-accent-line`
- `.fth-theme-status-pill`

## Figma Naming Plan

Use a stable naming convention so the library can be consumed consistently:

- `FTH / Foundations / Colors`
- `FTH / Foundations / Type`
- `FTH / Foundations / Radius`
- `FTH / Foundations / Shadows`
- `FTH / Foundations / Spacing`
- `FTH / Components / Panel`
- `FTH / Components / Status Pill`
- `FTH / Components / Stepper Item`
- `FTH / Components / Wizard Header`
- `FTH / Components / Class Card`

## Recommended Build Order

If Figma write access becomes available, publish in this order:

1. Foundations
2. Panels and status treatments
3. Stepper and wizard shell
4. Class card and chips
5. Component examples and usage notes

## Blocker

The session currently cannot write to a Figma canvas. Available Figma tooling here is limited to inspection and generation helpers, so the actual library file cannot be created from this environment alone.

If the next pass has a Figma file key and a write-capable canvas tool, the first concrete implementation should be:

- Create the shared foundation page
- Add color / type / radius / shadow styles
- Build the panel and status primitives
- Build the class card component set
- Add usage notes that point back to the shipped code paths above

