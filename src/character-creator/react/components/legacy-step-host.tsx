import { useLayoutEffect, useRef } from "react";

import type { WizardStepDefinition } from "../../character-creator-types";
import type { CharacterCreatorWizardController } from "../wizard-controller";

interface LegacyStepHostProps {
  controller: CharacterCreatorWizardController;
  stepDef: WizardStepDefinition | undefined;
  stepContentHtml: string;
  className?: string;
}

export function LegacyStepHost({
  controller,
  stepDef,
  stepContentHtml,
  className,
}: LegacyStepHostProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.innerHTML = stepContentHtml;
    controller.registerActiveStepElement(element);
    controller.activateCurrentStep(element);

    return () => {
      controller.cleanupActiveStep(stepDef, element);
    };
  }, [controller, stepContentHtml, stepDef]);

  return <section ref={containerRef} className={className} />;
}
