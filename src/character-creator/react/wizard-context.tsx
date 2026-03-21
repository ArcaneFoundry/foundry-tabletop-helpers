import { createContext, useContext } from "react";

import type { CharacterCreatorWizardController } from "./wizard-controller";

const WizardControllerContext = createContext<CharacterCreatorWizardController | null>(null);

export const WizardControllerProvider = WizardControllerContext.Provider;

export function useWizardController(): CharacterCreatorWizardController {
  const controller = useContext(WizardControllerContext);
  if (!controller) {
    throw new Error("Wizard controller context is not available");
  }
  return controller;
}
