import { describe, expect, it, vi } from "vitest";

import { handleOriginGalleryCornerActionClick } from "./origin-pane-primitives";

describe("origin-pane-primitives", () => {
  it("stops propagation before invoking an origin gallery corner action", () => {
    const stopPropagation = vi.fn();
    const onClick = vi.fn();

    handleOriginGalleryCornerActionClick({ stopPropagation }, onClick);

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
