export type ClassStepperLayoutMode = "wide" | "compact";

export const CLASS_STEPPER_COMPACT_BREAKPOINT = 520;

export function getClassStepperLayoutMode(width: number): ClassStepperLayoutMode {
  return width <= CLASS_STEPPER_COMPACT_BREAKPOINT ? "compact" : "wide";
}

export function shouldShowClassStepperSubsteps(
  layoutMode: ClassStepperLayoutMode,
  hasSubsteps: boolean,
): boolean {
  return layoutMode === "wide" && hasSubsteps;
}
