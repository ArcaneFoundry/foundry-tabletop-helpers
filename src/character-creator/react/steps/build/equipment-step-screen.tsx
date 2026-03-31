import type { CSSProperties, ReactNode } from "react";

import type {
  EquipmentSelection,
  EquipmentSourceOption,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import type {
  DerivedEquipmentState,
  EquipmentFlowResolution,
  EquipmentSourceResolution,
} from "../../../steps/equipment-flow-utils";
import { formatCurrencyCp } from "../../../steps/equipment-flow-utils";

const BUILD_HERO_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-build-hero-image)",
  borderColor: "var(--cc-build-hero-border)",
  boxShadow: "var(--cc-build-hero-shadow)",
};
const BUILD_PANEL_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-build-panel-image)",
  borderColor: "var(--cc-build-panel-border)",
  boxShadow: "var(--cc-build-panel-shadow)",
};
const BUILD_PANEL_SOFT_STYLE: CSSProperties = {
  backgroundImage: "var(--cc-build-panel-soft-image)",
  borderColor: "var(--cc-build-panel-border)",
  boxShadow: "var(--cc-build-panel-shadow)",
};

type EquipmentStepViewModel = {
  resolution?: EquipmentFlowResolution;
  selection?: EquipmentSelection;
  derived?: DerivedEquipmentState;
};

export function mergeEquipmentSelection(
  current: EquipmentSelection | undefined,
  patch: Partial<EquipmentSelection>,
): EquipmentSelection {
  return {
    ...(current ?? {}),
    ...patch,
  };
}

export function EquipmentStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as EquipmentStepViewModel | undefined;
  if (!viewModel?.resolution) return null;

  const selection = state.selections.equipment ?? viewModel.selection ?? {};
  const derived = viewModel.derived ?? {
    selectedClassOption: null,
    selectedBackgroundOption: null,
    baseGoldCp: 0,
    remainingGoldCp: 0,
    inventory: [],
    purchases: [],
    sales: [],
  };
  const chosenCount = Number(Boolean(selection.classOptionId)) + Number(Boolean(selection.backgroundOptionId));

  const updateSelection = (patch: Partial<EquipmentSelection>) => {
    controller.updateCurrentStepData(mergeEquipmentSelection(selection, patch));
  };

  return (
    <section className="flex flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="rounded-[1.65rem] border px-5 py-5 md:px-6" style={BUILD_HERO_STYLE}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-2">
              <MicroLabel>Build / Equipment</MicroLabel>
              <h2 className="cc-theme-title m-0 font-fth-cc-display text-[1.7rem] leading-[1.02] md:text-[1.95rem]">
                Choose the provisions that will arm your first march
              </h2>
              <p className="cc-theme-copy m-0 font-fth-cc-body text-[0.98rem] leading-7">
                Bind one class provision and one background provision. Each choice shows whether it grants a starting kit or turns that source into coin for the later shop.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryBadge label="Selections bound" value={`${chosenCount} of 2`} />
              <SummaryBadge label="Starting funds" value={formatCurrencyCp(derived.baseGoldCp)} />
              <SummaryBadge
                label="Next step"
                value={derived.baseGoldCp > 0 ? "Shop unlocks if gold remains" : "No shop funds yet"}
              />
            </div>
          </div>
        </header>

        <div className="cc-build-choice-layout grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.14fr)_minmax(20rem,0.86fr)]">
          <div className="cc-build-choice-layout__content pr-1">
            <div className="space-y-4">
              <ProvisionSourcePanel
                description="Select the class-issued pack or take the alternate coin award when that option exists."
                emptyMessage="Choose a class before selecting class provisions."
                selectedOptionId={selection.classOptionId}
                source={viewModel.resolution.classSource}
                title="Class provisions"
                onSelect={(optionId) => updateSelection({ classOptionId: optionId })}
              />

              <ProvisionSourcePanel
                description="Background equipment stacks with the class choice. Confirm the field kit you are taking with you."
                emptyMessage="Choose a background before selecting background provisions."
                selectedOptionId={selection.backgroundOptionId}
                source={viewModel.resolution.backgroundSource}
                title="Background provisions"
                onSelect={(optionId) => updateSelection({ backgroundOptionId: optionId })}
              />
            </div>
          </div>

          <aside className="cc-build-choice-layout__rail rounded-[1.5rem] border p-4 md:p-5" style={BUILD_PANEL_STYLE}>
            <div className="space-y-4">
              <div>
                <MicroLabel>Provision summary</MicroLabel>
                <h3 className="cc-theme-title m-0 mt-2 font-fth-cc-display text-[1.35rem] leading-none">
                  {chosenCount === 2 ? "Loadout committed" : "Awaiting both source choices"}
                </h3>
                <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
                  The later Shop screen will only handle purchases and sales. This screen is where class and background sources are bound into the starting loadout.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <SelectionLedger
                  description={derived.selectedClassOption?.description ?? "No class provision chosen yet."}
                  label="Class source"
                  value={derived.selectedClassOption?.title ?? "Unchosen"}
                />
                <SelectionLedger
                  description={derived.selectedBackgroundOption?.description ?? "No background provision chosen yet."}
                  label="Background source"
                  value={derived.selectedBackgroundOption?.title ?? "Unchosen"}
                />
              </div>

              <div className="rounded-[1.2rem] border px-4 py-3" style={BUILD_PANEL_SOFT_STYLE}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <MicroLabel>Current forecast</MicroLabel>
                    <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.15rem] leading-none">
                      {formatCurrencyCp(derived.remainingGoldCp)}
                    </div>
                  </div>
                  <ValueBadge>{derived.inventory.length} inventory line{derived.inventory.length === 1 ? "" : "s"}</ValueBadge>
                </div>
                <p className="cc-theme-body-muted m-0 mt-3 font-fth-cc-body text-[0.88rem] leading-6">
                  Gold shown here already reflects the current class and background choices. Shop transactions are intentionally out of scope for this step and will layer on later.
                </p>
              </div>

              <div className="space-y-3">
                <MicroLabel>Combined loadout</MicroLabel>
                {derived.inventory.length > 0 ? (
                  <div className="grid gap-2">
                    {derived.inventory.map((item) => (
                      <div className="cc-theme-card cc-theme-card--soft flex items-center justify-between gap-3 rounded-[1rem] px-3 py-3" key={item.uuid}>
                        <div className="min-w-0">
                          <div className="cc-theme-body truncate font-fth-cc-body text-[0.95rem] leading-6">
                            {item.name}
                          </div>
                          <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]">
                            {item.itemType ?? "Gear"}
                          </div>
                        </div>
                        <TokenPill>x{item.quantity}</TokenPill>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyPanelCopy>
                    Choose equipment-granting sources to preview the combined inventory here. Gold-only paths will instead increase the funds available for Shop.
                  </EmptyPanelCopy>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function ProvisionSourcePanel({
  title,
  description,
  source,
  selectedOptionId,
  emptyMessage,
  onSelect,
}: {
  title: string;
  description: string;
  source: EquipmentSourceResolution | null | undefined;
  selectedOptionId: string | undefined;
  emptyMessage: string;
  onSelect: (optionId: string) => void;
}) {
  return (
    <section className="rounded-[1.45rem] border p-4 md:p-5" style={BUILD_PANEL_STYLE}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <MicroLabel>{title}</MicroLabel>
          <h3 className="cc-theme-title m-0 mt-2 font-fth-cc-display text-[1.45rem] leading-none">
            {source?.label ?? "Source unavailable"}
          </h3>
          <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
            {source?.unsupportedReason ?? description}
          </p>
        </div>
        <ValueBadge>{source?.options.length ?? 0} option{source?.options.length === 1 ? "" : "s"}</ValueBadge>
      </div>

      {source?.options.length ? (
        <div className="mt-4 grid gap-3">
          {source.options.map((option) => (
            <button
              className={cn(
                "group rounded-[1.25rem] px-4 py-4 text-left transition",
                "cc-theme-card cc-theme-card--interactive",
                selectedOptionId === option.id && "cc-theme-card--selected",
              )}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="cc-theme-title font-fth-cc-display text-[1.15rem] leading-none">
                      {option.title}
                    </div>
                    <TokenPill muted={selectedOptionId !== option.id}>
                      {option.mode === "gold" ? "Gold path" : "Equipment bundle"}
                    </TokenPill>
                  </div>
                  <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.92rem] leading-6">
                    {option.description}
                  </p>
                </div>
                <SelectionSigil selected={selectedOptionId === option.id} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <TokenPill>{describeEquipmentOutcome(option)}</TokenPill>
                {option.goldCp > 0 ? <TokenPill>{formatCurrencyCp(option.goldCp)} extra</TokenPill> : null}
                {option.items.length > 0 ? <TokenPill>{sumItemQuantities(option)} item{sumItemQuantities(option) === 1 ? "" : "s"}</TokenPill> : null}
              </div>

              {option.items.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {option.items.slice(0, 4).map((item) => (
                    <TokenPill key={`${option.id}-${item.uuid}`} muted>
                      {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
                    </TokenPill>
                  ))}
                  {option.items.length > 4 ? <TokenPill muted>+{option.items.length - 4} more</TokenPill> : null}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyPanelCopy>{source?.unsupportedReason ?? emptyMessage}</EmptyPanelCopy>
        </div>
      )}
    </section>
  );
}

function describeEquipmentOutcome(option: EquipmentSourceOption): string {
  if (option.mode === "gold") {
    return `Receive ${formatCurrencyCp(option.totalValueCp + option.goldCp)}`;
  }
  if (option.items.length === 0) {
    return option.goldCp > 0 ? `Carry ${formatCurrencyCp(option.goldCp)}` : "Provision bundle";
  }
  return `${sumItemQuantities(option)} item${sumItemQuantities(option) === 1 ? "" : "s"} issued`;
}

function sumItemQuantities(option: EquipmentSourceOption): number {
  return option.items.reduce((sum, item) => sum + item.quantity, 0);
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-theme-card cc-theme-card--soft min-w-[11rem] rounded-[1.1rem] px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="cc-theme-body mt-2 font-fth-cc-body text-[0.96rem] leading-6">{value}</div>
    </div>
  );
}

function SelectionLedger({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="cc-theme-card cc-theme-card--soft rounded-[1.1rem] px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="cc-theme-title mt-2 font-fth-cc-display text-[1.08rem] leading-none">{value}</div>
      <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.88rem] leading-6">{description}</p>
    </div>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
      <div className="cc-theme-kicker font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.22em]">
        {children}
      </div>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <div className="cc-theme-badge inline-flex items-center rounded-full px-3 py-1 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.18em]">
      {children}
    </div>
  );
}

function TokenPill({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.16em]",
        muted ? "cc-theme-pill--muted" : "cc-theme-pill",
      )}
    >
      {children}
    </span>
  );
}

function SelectionSigil({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[0.95rem]",
        "cc-theme-sigil",
        selected && "cc-theme-sigil--selected",
      )}
    >
      <i aria-hidden="true" className={selected ? "fa-solid fa-check" : "fa-solid fa-circle"} />
      <span className="sr-only">{selected ? "Selected" : "Not selected"}</span>
    </span>
  );
}

function EmptyPanelCopy({ children }: { children: ReactNode }) {
  return (
    <div className="cc-theme-empty rounded-[1.1rem] border border-dashed px-4 py-4 font-fth-cc-body text-[0.92rem] leading-6">
      {children}
    </div>
  );
}
