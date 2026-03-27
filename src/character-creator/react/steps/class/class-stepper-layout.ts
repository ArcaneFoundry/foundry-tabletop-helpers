import { useEffect, useLayoutEffect, useState } from "react";

export type ClassStepperLayoutMode = "wide" | "compact";

export const CLASS_STEPPER_COMPACT_BREAKPOINT = 800;

export function getClassStepperLayoutMode(width: number): ClassStepperLayoutMode {
  return width <= CLASS_STEPPER_COMPACT_BREAKPOINT ? "compact" : "wide";
}

type LayoutModeTarget = Pick<HTMLElement, "getBoundingClientRect">;

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function syncClassStepperLayoutMode(
  container: LayoutModeTarget | null,
  setLayoutMode: (layoutMode: ClassStepperLayoutMode) => void,
): (() => void) | undefined {
  if (!container) return undefined;

  const updateLayoutMode = (width: number) => {
    setLayoutMode(getClassStepperLayoutMode(width));
  };

  updateLayoutMode(container.getBoundingClientRect().width);

  if (typeof ResizeObserver === "undefined") return undefined;

  const observer = new ResizeObserver((entries) => {
    updateLayoutMode(entries[0]?.contentRect.width ?? container.getBoundingClientRect().width);
  });

  observer.observe(container as HTMLElement);

  return () => {
    observer.disconnect();
  };
}

export function useClassStepperLayoutMode(): [
  ClassStepperLayoutMode,
  (container: HTMLElement | null) => void,
] {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [layoutMode, setLayoutMode] = useState<ClassStepperLayoutMode>("wide");

  useIsomorphicLayoutEffect(() => syncClassStepperLayoutMode(container, setLayoutMode), [container]);

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
