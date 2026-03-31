import type { CSSProperties } from "react";

import type {
  ReactWizardStepProps,
  WizardStepDefinition,
  WizardStepRenderController,
} from "../../../character-creator-types";
import { LegacyStepHost } from "../../components/legacy-step-host";
import { ReactStepHost } from "../../components/react-step-host";

const BUILD_FLOW_STEP_IDS = new Set([
  "abilities",
  "equipment",
  "equipmentShop",
]);

type BuildFlowStepViewModel = {
  stepTitle?: string;
  stepLabel?: string;
  stepDescription?: string;
  selection?: {
    classOptionId?: string;
    backgroundOptionId?: string;
    remainingGoldCp?: number;
  };
  derived?: {
    baseGoldCp?: number;
    remainingGoldCp?: number;
    selectedClassOption?: { label?: string } | null;
    selectedBackgroundOption?: { label?: string } | null;
  };
};

const BUILD_SHELL_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-build-shell-image)",
  borderColor: "var(--cc-build-panel-border)",
  boxShadow: "var(--cc-build-panel-shadow)",
};
const BUILD_PANEL_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-build-panel-image)",
  borderColor: "var(--cc-build-panel-border)",
  boxShadow: "var(--cc-build-panel-shadow)",
};

interface LegacyBuildStepController extends WizardStepRenderController {
  registerActiveStepElement(element: HTMLElement): void;
  activateCurrentStep(element: HTMLElement): void;
  cleanupActiveStep(stepDef: WizardStepDefinition | undefined, element: HTMLElement): void;
}

export function isBuildFlowStep(stepId: string | undefined): boolean {
  return Boolean(stepId && BUILD_FLOW_STEP_IDS.has(stepId));
}

export function getBuildFlowTransitionKey(stepId: string | undefined): string {
  return isBuildFlowStep(stepId) ? "build-flow" : (stepId ?? "");
}

export function BuildFlowRouteHost(props: ReactWizardStepProps) {
  if (props.step.reactComponent) {
    return (
      <ReactStepHost
        controller={props.controller}
        shellContext={props.shellContext}
        state={props.state}
        stepDef={props.step}
      />
    );
  }

  if (props.step.renderMode === "react") {
    return <BuildFlowFallbackScreen {...props} />;
  }

  if (!isLegacyBuildStepController(props.controller)) {
    return <BuildFlowFallbackScreen {...props} />;
  }

  return (
    <LegacyStepHost
      className="flex min-h-full flex-col"
      controller={props.controller}
      stepContentHtml={props.shellContext.stepContentHtml}
      stepDef={props.step}
    />
  );
}

function BuildFlowFallbackScreen({ shellContext }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as BuildFlowStepViewModel | undefined;
  const title = viewModel?.stepTitle && viewModel?.stepLabel
    ? `${viewModel.stepTitle} / ${viewModel.stepLabel}`
    : [viewModel?.stepTitle, viewModel?.stepLabel].filter(Boolean).join(" ");
  const selectedClassKit = viewModel?.derived?.selectedClassOption?.label;
  const selectedBackgroundKit = viewModel?.derived?.selectedBackgroundOption?.label;
  const remainingGoldCp = viewModel?.derived?.remainingGoldCp ?? viewModel?.selection?.remainingGoldCp ?? 0;
  const baseGoldCp = viewModel?.derived?.baseGoldCp ?? 0;
  const showGold = baseGoldCp > 0 || remainingGoldCp > 0;

  return (
    <section className="flex flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[1.5rem] border p-5" style={BUILD_SHELL_STYLE}>
        <div className="space-y-2">
          <div className="cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em]">
            Build
          </div>
          <h2 className="cc-theme-title m-0 font-fth-cc-display text-[1.5rem] leading-none">
            {title || "Build Choices"}
          </h2>
          <p className="cc-theme-copy m-0 max-w-3xl font-fth-cc-body text-[0.98rem] leading-7">
            {viewModel?.stepDescription ?? "This build chapter view is being restored after an incomplete migration. Your current selections are still available below while we finish the mounted build-shell path."}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <SummaryCard
            label="Class provisions"
            value={selectedClassKit ?? "Not selected yet"}
          />
          <SummaryCard
            label="Background provisions"
            value={selectedBackgroundKit ?? "Not selected yet"}
          />
          {showGold ? (
            <SummaryCard
              label="Remaining gold"
              value={`${formatGoldCp(remainingGoldCp)} of ${formatGoldCp(baseGoldCp)} available`}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border px-4 py-3" style={BUILD_PANEL_STYLE}>
      <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="cc-theme-body mt-2 font-fth-cc-body text-[0.98rem] leading-6">
        {value}
      </div>
    </div>
  );
}

function formatGoldCp(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 gp";
  return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)} gp`;
}

function isLegacyBuildStepController(controller: WizardStepRenderController): controller is LegacyBuildStepController {
  return typeof (controller as Partial<LegacyBuildStepController>).registerActiveStepElement === "function"
    && typeof (controller as Partial<LegacyBuildStepController>).activateCurrentStep === "function"
    && typeof (controller as Partial<LegacyBuildStepController>).cleanupActiveStep === "function";
}
