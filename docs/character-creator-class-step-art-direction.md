# Character Creator Class Step Art Direction

This document captures the current analysis for where AI-generated art assets can improve the Character Creator class-selection step without making the screen feel crowded, noisy, or less usable.

Use this as a reference when generating assets, planning visual polish, or deciding whether a decorative addition belongs on the first class-selection screen or should move to a later step.

## Scope

This analysis is specifically about the first React-native class-selection page, not the later class-summary step.

The goal is to elevate presentation while preserving the current product direction:

- portrait-first class cards
- compact, touch-friendly selection
- readable progress through the wizard
- no heavy detail pane on the class-selection page
- richer class recap reserved for later steps

## Current Step Snapshot

The current React class-selection step already has a strong structure:

- parchment-toned window body with carved-plaque heading treatment
- compact progress rail under the title
- dense portrait-card grid as the dominant visual element
- class cards with ribbon banners, portrait frames, compact summary chips, and selected-only crest feedback
- no lower details panel competing with the grid

This means the page does not need more content. It needs a small number of high-value surface treatments.

## Reference Image Takeaways

The supplied references consistently use the same visual language:

- dark carved wood and brass framing
- warm parchment as the main reading surface
- heraldic ornaments and engraved dividers
- selective glow, torchlight warmth, and metallic trim
- a few ceremonial focal points instead of decoration everywhere

The references feel premium because they use ornament to define structure, not because every region is busy.

That is the right lesson to borrow for the class-selection step.

## Design Principles For This Page

Any generated art used on this screen should follow these rules:

1. Portraits stay dominant.
2. Decoration should reinforce layout, not compete with the class art.
3. Reusable modular assets are better than many bespoke one-off illustrations.
4. The page should feel richer at a glance, not denser on inspection.
5. The first screen should still read as fast, interactive selection UI rather than a static poster.

## Best Opportunities For AI-Generated Assets

### 1. Title Plaque

Highest-value upgrade.

The `Choose Your Class` header is the cleanest place to add more fantasy character without hurting card readability. A generated wide plaque asset could add:

- carved wood grain
- brass trim
- subtle engraved filigree
- faint torchlit warmth or ember glow

Why this works:

- it improves first impression immediately
- it is visually isolated from the card grid
- it can be reused for later wizard steps

### 2. Parchment Field Background

The main content field can support a more tactile background layer as long as it stays quiet.

Recommended treatment:

- faint parchment fibers and staining
- subtle edge darkening
- extremely low-contrast cartography or manuscript motifs

Why this works:

- it makes the page feel less flat
- it supports the tabletop/fantasy tone
- it does not add new UI clutter

This should remain closer to texture than illustration.

### 3. Ornament Kit For Corners And Dividers

Small reusable generated embellishments would help the page feel more intentionally framed.

Best uses:

- header corner flourishes
- progress-rail divider accents
- section separators
- card-corner micro-ornaments

Why this works:

- tiny ornaments add polish without adding content
- one small asset kit can be reused across multiple steps
- it supports the carved-plaque and parchment styling already in place

### 4. Selected-State Medallion Accent

The selected state is already compact and effective. AI-generated art can improve it if used sparingly.

Recommended direction:

- keep the selected icon small
- add a generated medallion backplate, laurel ring, or engraved seal treatment behind it
- reserve the richer ornament only for selected cards

Why this works:

- selection becomes more ceremonial and satisfying
- only one card shows the full embellishment at a time
- it avoids decorating every card equally

### 5. Chip Backplates For Class Summary Data

The hit die, primary ability, and saves chips are useful and should remain compact.

AI-generated assets could improve them through very small decorative surfaces:

- engraved brass tabs
- dark leather labels
- carved token or plate backgrounds

Why this works:

- it elevates the class info without increasing footprint
- it helps the chips feel integrated into the card frame

This should be subtle. The chips are support content, not a showcase area.

## Lower-Priority Opportunities

These could help later, but they are not the first assets to generate:

- a subtle bottom action-bar base texture behind navigation buttons
- shared crest or sigil flourishes behind class-theme iconography
- a very thin portrait underframe flourish at the bottom edge of each card

These are optional because the current page already has a strong enough frame and card hierarchy without them.

## What To Avoid

The reference images include decorative objects and heavy framing that would not scale well to the current class grid.

Avoid these on the class-selection page:

- large props such as candles, dice, scrolls, feathers, wax seals, or tabletop still-life elements
- thick ornate frames around every class portrait
- busy illustrated backgrounds behind the card grid
- decorative overlays that cover significant portions of the portraits
- a large number of unique generated assets that make the screen visually inconsistent

Those choices would likely make the page feel cramped and reduce the elegance of the portrait-first layout.

## Recommended Visual Hierarchy

The target balance for this page should stay roughly:

- 80% clean interactive grid and readable UI
- 20% ornamental fantasy surface treatment

The decoration should mostly live in the shell and framing, not inside the cards' main content area.

## Recommended Asset Pack

If we generate assets for this page, the most useful first pack would be:

1. `class-step-title-plaque`
2. `class-step-parchment-field`
3. `ornament-corner-kit`
4. `ornament-divider-kit`
5. `selected-medallion-backplate`
6. `info-chip-surface-kit`

This gives us one strong hero asset, one broad surface texture, and a small reusable ornament system.

## Suggested Implementation Order

When we start using generated art in the UI, the safest rollout order is:

1. add the title plaque
2. add the parchment field texture
3. add the small ornament kit
4. enhance the selected-state medallion
5. optionally refine the info-chip surfaces

This order improves the shell first and keeps the portrait cards stable while we evaluate density.

## Decision Rule For Future Additions

Before adding any decorative asset to this step, ask:

Does this make the class portraits and selection flow feel more premium without making the screen read slower?

If the answer is no, the element probably belongs on a later summary or review step instead of the initial class-selection page.
