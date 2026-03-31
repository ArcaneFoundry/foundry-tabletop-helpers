import { describe, expect, it } from "vitest";

import { resolveCreationSpellEntitlements } from "./spell-selection-resolver";

describe("spell selection resolver", () => {
  it("treats paladin level 1 as a no-cantrip prepared caster", () => {
    const entitlements = resolveCreationSpellEntitlements({
      classIdentifier: "paladin",
      className: "Paladin",
      level: 1,
      progression: "half",
      classDoc: {
        system: {
          advancement: [
            {
              type: "ScaleValue",
              configuration: {
                identifier: "max-prepared",
                scale: {
                  1: { value: 2 },
                },
              },
            },
          ],
          spellcasting: {
            preparation: {
              formula: "@scale.paladin.max-prepared",
            },
          },
        },
      },
    });

    expect(entitlements).toMatchObject({
      maxCantrips: 0,
      maxSpells: null,
      preparedLimit: 2,
      usesPreparedSpells: true,
      usesPreparedSpellPicker: true,
    });
  });

  it("treats ranger level 1 as a prepared caster without a known-spell cap", () => {
    const entitlements = resolveCreationSpellEntitlements({
      classIdentifier: "ranger",
      className: "Ranger",
      level: 1,
      progression: "half",
      classDoc: {
        system: {
          advancement: [
            {
              type: "ScaleValue",
              configuration: {
                identifier: "max-prepared",
                scale: {
                  1: { value: 2 },
                },
              },
            },
          ],
          spellcasting: {
            preparation: {
              formula: "@scale.ranger.max-prepared",
            },
          },
        },
      },
    });

    expect(entitlements).toMatchObject({
      maxCantrips: 0,
      maxSpells: null,
      preparedLimit: 2,
      usesPreparedSpells: true,
      usesPreparedSpellPicker: true,
      swapLimit: 0,
    });
  });
});
