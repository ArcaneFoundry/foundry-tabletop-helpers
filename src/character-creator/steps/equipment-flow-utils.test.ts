import { describe, expect, it } from "vitest";

import { __equipmentFlowInternals } from "./equipment-flow-utils";

describe("equipment-flow-utils", () => {
  it("extracts a PHB class starting equipment row from table markup", () => {
    const doc = {
      system: {
        description: {
          value: `
            <table class="core-class-traits">
              <tbody>
                <tr>
                  <th scope="row"><p><strong>Starting Equipment</strong></p></th>
                  <td>
                    <p><em>Choose A, B, or C:</em> (A) @UUID[Compendium.test.Item.chain]{Chain Mail}, @UUID[Compendium.test.Item.sword]{Greatsword}, and [[/award 4GP]]; or (C) [[/award 155GP]]</p>
                  </td>
                </tr>
              </tbody>
            </table>
            <p>Fighters rule many battlefields.</p>
          `,
        },
      },
    };

    expect(__equipmentFlowInternals.extractEquipmentSegment(doc)).toBe(
      "Choose A, B, or C: (A) @UUID[Compendium.test.Item.chain]{Chain Mail}, @UUID[Compendium.test.Item.sword]{Greatsword}, and 4GP; or (C) 155GP",
    );
  });
});
