import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: new Proxy({}, {
      get: (_target, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => {
        const {
          animate: _animate,
          initial: _initial,
          transition: _transition,
          children,
          ...domProps
        } = props;
        return React.createElement(tag, { ...domProps, ref }, children as React.ReactNode);
      }),
    }),
    useReducedMotion: () => true,
  };
});

import type { WizardShellContext } from "../../character-creator-types";
import { WizardShell } from "./wizard-shell";

describe("WizardShell", () => {
  it("keeps the mounted shell as the primary vertical scroll container", () => {
    const shellContext = {
      steps: [
        { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "complete", active: true, index: 0 },
        { id: "origins", label: "Origins", icon: "fa-solid fa-scroll", status: "pending", active: false, index: 1 },
      ],
      stepContentHtml: "",
      currentStepId: "class",
      currentStepLabel: "Class",
      currentStepIcon: "fa-solid fa-shield",
      canGoBack: false,
      canGoNext: true,
      isReviewStep: false,
      statusHint: "Ready",
      atmosphereClass: "cc-atmosphere--nature",
      chapterKey: "class",
    } satisfies WizardShellContext;

    const markup = renderToStaticMarkup(createElement(WizardShell, {
      shellContext,
      stepContent: createElement("section", { "data-step-content": "true" }, "Step body"),
      onBack: vi.fn(),
      onNext: vi.fn(),
      onJumpToStep: vi.fn(),
      onCreateCharacter: vi.fn(async () => {}),
    }));

    expect(markup).toContain("fth-react-scrollbar relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain");
    expect(markup).toContain('data-step-content="true"');
    expect(markup.indexOf("fth-react-scrollbar relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain"))
      .toBeLessThan(markup.indexOf('data-step-content="true"'));
    expect(markup.match(/overflow-y-auto/g)?.length ?? 0).toBe(1);
  });
});
