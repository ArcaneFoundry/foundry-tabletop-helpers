import { useEffect, useState } from "react";

export type ClassStepperLayoutMode = "wide" | "compact";

export const CLASS_STEPPER_COMPACT_BREAKPOINT = 520;

export function getClassStepperLayoutMode(width: number): ClassStepperLayoutMode {
  return width <= CLASS_STEPPER_COMPACT_BREAKPOINT ? "compact" : "wide";
}

export function useClassStepperLayoutMode(): [
  ClassStepperLayoutMode,
  (container: HTMLElement | null) => void,
] {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<ClassStepperLayoutMode>("wide");

  useEffect(() => {
    if (!container) return;

    const updateLayoutMode = (width: number) => {
      setLayoutMode(getClassStepperLayoutMode(width));
    };

    updateLayoutMode(container.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      updateLayoutMode(entries[0]?.contentRect.width ?? container.getBoundingClientRect().width);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [container]);

  return [layoutMode, setContainer];
}

export function shouldShowClassStepperSubsteps({
  layoutMode,
  hasSubsteps,
}: {
  layoutMode: ClassStepperLayoutMode;
  hasSubsteps: boolean;
}): boolean {
  return layoutMode === "wide" && hasSubsteps;
}
