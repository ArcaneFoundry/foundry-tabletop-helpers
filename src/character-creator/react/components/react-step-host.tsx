import type { ReactWizardStepProps, WizardStepDefinition, WizardStepRenderController, WizardShellContext, WizardState } from "../../character-creator-types";

interface ReactStepHostProps {
  controller: WizardStepRenderController;
  shellContext: WizardShellContext;
  state: WizardState;
  stepDef: WizardStepDefinition;
}

export function ReactStepHost({
  controller,
  shellContext,
  state,
  stepDef,
}: ReactStepHostProps) {
  const StepComponent = stepDef.reactComponent;
  if (!StepComponent) return null;

  const props: ReactWizardStepProps = {
    shellContext,
    state,
    controller,
    step: stepDef,
  };

  return <StepComponent {...props} />;
}
