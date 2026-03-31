import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { __wizardShellInternals, WizardShell } from "./wizard-shell";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WizardShell", () => {
  it("only resets scroll when the active step changes", () => {
    expect(__wizardShellInternals.shouldResetWizardScroll("class", "origins")).toBe(true);
    expect(__wizardShellInternals.shouldResetWizardScroll("class", "class")).toBe(false);
    expect(__wizardShellInternals.shouldResetWizardScroll(undefined, "class")).toBe(true);
  });

  it("queues a second scroll reset for the next animation frame", () => {
    const callbacks: Array<FrameRequestCallback> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const scrollContainer = {
      scrollTop: 944,
      scrollTo: vi.fn(),
    };

    const cleanup = __wizardShellInternals.queueWizardScrollReset(scrollContainer);
    expect(scrollContainer.scrollTop).toBe(0);
    expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(callbacks).toHaveLength(1);

    scrollContainer.scrollTop = 411;
    callbacks[0](16.7);
    expect(scrollContainer.scrollTop).toBe(0);
    expect(scrollContainer.scrollTo).toHaveBeenCalledTimes(2);

    cleanup();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

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

  it("renders the shared footer as a summary panel with current step context", () => {
    const shellContext = {
      steps: [
        { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "complete", active: true, index: 0 },
        { id: "origins", label: "Origins", icon: "fa-solid fa-scroll", status: "pending", active: false, index: 1 },
      ],
      stepContentHtml: "",
      currentStepId: "class",
      currentStepLabel: "Choose Your Class",
      currentStepIcon: "fa-solid fa-shield",
      canGoBack: false,
      canGoNext: true,
      isReviewStep: false,
      statusHint: "Ready",
      atmosphereClass: "cc-atmosphere--nature",
      chapterKey: "class",
      localProgress: {
        current: 1,
        total: 2,
        label: "Step 1 of 2",
        detail: "Choose the class that will shape the rest of the build.",
        percent: 50,
      },
    } satisfies WizardShellContext;

    const markup = renderToStaticMarkup(createElement(WizardShell, {
      shellContext,
      stepContent: createElement("section", null, "Step body"),
      onBack: vi.fn(),
      onNext: vi.fn(),
      onJumpToStep: vi.fn(),
      onCreateCharacter: vi.fn(async () => {}),
    }));

    expect(markup).toContain('data-wizard-footer-summary="true"');
    expect(markup).toContain("cc-theme-card--raised");
    expect(markup).toContain("cc-shell-footer-btn");
    expect(markup).toContain("Class");
    expect(markup).toContain("Step 1 of 2");
    expect(markup).toContain("Choose Your Class");
    expect(markup).toContain("Choose the class that will shape the rest of the build.");
    expect(markup).toContain("Ready");
  });

  it("renders the Lore chapter label for the final step", () => {
    const shellContext = {
      steps: [
        { id: "portrait", label: "Portrait", icon: "fa-solid fa-image", status: "complete", active: true, index: 0 },
        { id: "review", label: "Review", icon: "fa-solid fa-stars", status: "pending", active: false, index: 1 },
      ],
      stepContentHtml: "",
      currentStepId: "review",
      currentStepLabel: "Review",
      currentStepIcon: "fa-solid fa-stars",
      canGoBack: true,
      canGoNext: true,
      isReviewStep: false,
      statusHint: "",
      atmosphereClass: "cc-atmosphere--gold",
      chapterKey: "lore",
      chapterSceneKey: "binding",
    } satisfies WizardShellContext;

    const markup = renderToStaticMarkup(createElement(WizardShell, {
      shellContext,
      stepContent: createElement("section", null, "Step body"),
      onBack: vi.fn(),
      onNext: vi.fn(),
      onJumpToStep: vi.fn(),
      onCreateCharacter: vi.fn(async () => {}),
    }));

    expect(markup).toContain("Lore");
    expect(markup).toContain('data-scene-key="binding"');
  });

  it("aggregates granular steps into the requested major-step sequence for shell progress", () => {
    const shellContext = {
      steps: [
        { id: "class", label: "Class", icon: "fa-solid fa-shield", status: "complete", active: false, index: 0 },
        { id: "species", label: "Species", icon: "fa-solid fa-feather", status: "complete", active: false, index: 1 },
        { id: "background", label: "Background", icon: "fa-solid fa-scroll", status: "complete", active: false, index: 2 },
        { id: "backgroundAsi", label: "Background Ability Scores", icon: "fa-solid fa-chart-line", status: "complete", active: false, index: 3 },
        { id: "originSummary", label: "Origin Summary", icon: "fa-solid fa-layer-group", status: "complete", active: false, index: 4 },
        { id: "classChoices", label: "Class Skills", icon: "fa-solid fa-list-check", status: "complete", active: false, index: 5 },
        { id: "abilities", label: "Ability Scores", icon: "fa-solid fa-dice-d20", status: "complete", active: false, index: 6 },
        { id: "spells", label: "Spells", icon: "fa-solid fa-wand-sparkles", status: "complete", active: false, index: 7 },
        { id: "equipment", label: "Equipment", icon: "fa-solid fa-swords", status: "complete", active: false, index: 8 },
        { id: "portrait", label: "Portrait", icon: "fa-solid fa-image", status: "pending", active: true, index: 9 },
        { id: "review", label: "Review & Create", icon: "fa-solid fa-stars", status: "pending", active: false, index: 10 },
      ],
      stepContentHtml: "",
      currentStepId: "portrait",
      currentStepLabel: "Portrait",
      currentStepIcon: "fa-solid fa-image",
      canGoBack: true,
      canGoNext: true,
      isReviewStep: false,
      statusHint: "",
      atmosphereClass: "cc-atmosphere--gold",
      chapterKey: "lore",
      localProgress: {
        current: 10,
        total: 11,
        label: "Step 10 of 11",
        detail: "Bind a portrait or leave it blank.",
        percent: 91,
      },
    } satisfies WizardShellContext;

    const markup = renderToStaticMarkup(createElement(WizardShell, {
      shellContext,
      stepContent: createElement("section", null, "Step body"),
      onBack: vi.fn(),
      onNext: vi.fn(),
      onJumpToStep: vi.fn(),
      onCreateCharacter: vi.fn(async () => {}),
    }));

    expect(markup).toContain("Lore");
    expect(markup).toContain("Step 8 of 8");
    expect(markup).toContain("Skills");
    expect(markup).toContain("Abilities");
    expect(markup).toContain("Spells");
    expect(markup).not.toContain("Background Ability Scores");
    expect(markup).not.toContain("Origin Summary");
  });

  it.each([
    ["class", "Class", "class"],
    ["species", "Species", "species"],
    ["background", "Background", "background"],
    ["skills", "Skills", "classChoices"],
    ["abilities", "Abilities", "abilities"],
    ["spells", "Spells", "spells"],
    ["equipment", "Equipment", "equipment"],
  ] as const)("renders the %s chapter label as %s", (chapterKey, expectedLabel, currentStepId) => {
    const shellContext = {
      steps: [
        { id: currentStepId, label: expectedLabel, icon: "fa-solid fa-star", status: "complete", active: true, index: 0 },
      ],
      stepContentHtml: "",
      currentStepId,
      currentStepLabel: expectedLabel,
      currentStepIcon: "fa-solid fa-star",
      canGoBack: false,
      canGoNext: false,
      isReviewStep: false,
      statusHint: "",
      atmosphereClass: "cc-atmosphere--gold",
      chapterKey,
    } satisfies WizardShellContext;

    const markup = renderToStaticMarkup(createElement(WizardShell, {
      shellContext,
      stepContent: createElement("section", null, "Step body"),
      onBack: vi.fn(),
      onNext: vi.fn(),
      onJumpToStep: vi.fn(),
      onCreateCharacter: vi.fn(async () => {}),
    }));

    expect(markup).toContain(expectedLabel);
  });
});
