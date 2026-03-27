import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CLASS_STEPPER_COMPACT_BREAKPOINT,
  getClassStepperLayoutMode,
  syncClassStepperLayoutMode,
  shouldShowClassStepperSubsteps,
} from "./class-stepper-layout";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) =>
          React.forwardRef((props: Record<string, unknown>, ref) => {
            const {
              animate: _animate,
              children,
              initial: _initial,
              transition: _transition,
              ...domProps
            } = props;
            return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
          }),
      },
    ),
    useReducedMotion: () => true,
  };
});

import { ClassAggregateStepper } from "./class-step-screen";

function createAggregateStepperModel() {
  return {
    milestones: [
      { id: "class", label: "Class", icon: "fa-solid fa-shield-halved", active: true, status: "selection-active" as const },
      { id: "origins", label: "Origins", icon: "fa-solid fa-scroll", active: false, status: "pending" as const },
      { id: "build", label: "Build", icon: "fa-solid fa-hammer", active: false, status: "pending" as const },
      { id: "finalize", label: "Finalize", icon: "fa-solid fa-stars", active: false, status: "pending" as const },
    ],
    substeps: [
      { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles", active: true, status: "selection-active" as const },
      { id: "classExpertise", label: "Expertise", icon: "fa-solid fa-bullseye", active: false, status: "pending" as const },
    ],
    showSubsteps: true,
  };
}

describe("class stepper layout", () => {
  it("switches to compact mode at and below the compact breakpoint", () => {
    expect(CLASS_STEPPER_COMPACT_BREAKPOINT).toBe(800);
    expect(getClassStepperLayoutMode(801)).toBe("wide");
    expect(getClassStepperLayoutMode(800)).toBe("compact");
    expect(getClassStepperLayoutMode(319)).toBe("compact");
  });

  it("keeps substeps visible only when the layout is wide and substeps exist", () => {
    expect(shouldShowClassStepperSubsteps({ layoutMode: "wide", hasSubsteps: true })).toBe(true);
    expect(shouldShowClassStepperSubsteps({ layoutMode: "wide", hasSubsteps: false })).toBe(false);
    expect(shouldShowClassStepperSubsteps({ layoutMode: "compact", hasSubsteps: true })).toBe(false);
    expect(shouldShowClassStepperSubsteps({ layoutMode: "compact", hasSubsteps: false })).toBe(false);
  });

  it("hides substeps in compact mode while exposing the layout hook", () => {
    const markup = renderToStaticMarkup(createElement(ClassAggregateStepper, {
      layoutMode: "compact",
      model: createAggregateStepperModel() as never,
      prefersReducedMotion: true,
    }));

    expect(markup).toContain('data-layout-mode="compact"');
    expect(markup.match(/fth-class-stepper__compact-row/g)).toHaveLength(2);
    expect(markup).toContain("fth-class-stepper__connector");
    expect(markup).not.toContain("Skills");
    expect(markup).not.toContain("Expertise");
  });

  it("keeps substeps visible in wide mode while exposing the layout hook", () => {
    const markup = renderToStaticMarkup(createElement(ClassAggregateStepper, {
      layoutMode: "wide",
      model: createAggregateStepperModel() as never,
      prefersReducedMotion: true,
    }));

    expect(markup).toContain('data-layout-mode="wide"');
    expect(markup).not.toContain("fth-class-stepper__compact-row");
    expect(markup).toContain("Skills");
    expect(markup).toContain("Expertise");
  });

  it("measures immediately and responds to resize events", () => {
    const modes: string[] = [];
    const element = {
      getBoundingClientRect: () => ({ width: 860 }),
    } as Pick<HTMLElement, "getBoundingClientRect">;

    class MockResizeObserver {
      static instances: MockResizeObserver[] = [];

      readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        MockResizeObserver.instances.push(this);
      }

      disconnect() {}

      observe() {}

      emit(width: number) {
        this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    try {
      const cleanup = syncClassStepperLayoutMode(element, (layoutMode) => {
        modes.push(layoutMode);
      });

      expect(modes).toEqual(["wide"]);

      MockResizeObserver.instances[0]?.emit(760);
      expect(modes).toEqual(["wide", "compact"]);

      cleanup?.();
    } finally {
      vi.unstubAllGlobals();
      MockResizeObserver.instances = [];
    }
  });
});
