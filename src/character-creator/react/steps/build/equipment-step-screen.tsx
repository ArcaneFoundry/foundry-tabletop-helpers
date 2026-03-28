import type { ReactNode } from "react";

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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
        <header className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(180deg,rgba(31,25,29,0.96),rgba(15,15,19,0.98))] px-5 py-5 shadow-[0_26px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-2">
              <MicroLabel>Build / Equipment</MicroLabel>
              <h2 className="m-0 font-fth-cc-display text-[1.7rem] leading-[1.02] text-[#f7e7c6] md:text-[1.95rem]">
                Choose the provisions that will arm your first march
              </h2>
              <p className="m-0 font-fth-cc-body text-[0.98rem] leading-7 text-[#d7d0cb]">
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

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.14fr)_minmax(20rem,0.86fr)]">
          <div className="fth-react-scrollbar min-h-0 overflow-y-auto pr-1">
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

          <aside className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,29,40,0.94),rgba(16,16,20,0.98))] p-4 shadow-[0_24px_50px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.04)] md:p-5">
            <div className="space-y-4">
              <div>
                <MicroLabel>Provision summary</MicroLabel>
                <h3 className="m-0 mt-2 font-fth-cc-display text-[1.35rem] leading-none text-[#f7e7c6]">
                  {chosenCount === 2 ? "Loadout committed" : "Awaiting both source choices"}
                </h3>
                <p className="m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6 text-[#cec5bf]">
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

              <div className="rounded-[1.2rem] border border-[#e9c176]/18 bg-[rgba(233,193,118,0.08)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <MicroLabel>Current forecast</MicroLabel>
                    <div className="mt-2 font-fth-cc-display text-[1.15rem] leading-none text-[#f7e7c6]">
                      {formatCurrencyCp(derived.remainingGoldCp)}
                    </div>
                  </div>
                  <ValueBadge>{derived.inventory.length} inventory line{derived.inventory.length === 1 ? "" : "s"}</ValueBadge>
                </div>
                <p className="m-0 mt-3 font-fth-cc-body text-[0.88rem] leading-6 text-[#d6ccc3]">
                  Gold shown here already reflects the current class and background choices. Shop transactions are intentionally out of scope for this step and will layer on later.
                </p>
              </div>

              <div className="space-y-3">
                <MicroLabel>Combined loadout</MicroLabel>
                {derived.inventory.length > 0 ? (
                  <div className="grid gap-2">
                    {derived.inventory.map((item) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-3"
                        key={item.uuid}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-fth-cc-body text-[0.95rem] leading-6 text-[#f2ebe2]">
                            {item.name}
                          </div>
                          <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em] text-[#b9b0a7]">
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
    <section className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,30,39,0.94),rgba(18,18,22,0.98))] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(255,255,255,0.03)] md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <MicroLabel>{title}</MicroLabel>
          <h3 className="m-0 mt-2 font-fth-cc-display text-[1.45rem] leading-none text-[#f7e7c6]">
            {source?.label ?? "Source unavailable"}
          </h3>
          <p className="m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6 text-[#cdc4be]">
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
                "group rounded-[1.25rem] border px-4 py-4 text-left transition",
                selectedOptionId === option.id
                  ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(73,60,55,0.34),rgba(32,27,29,0.92))] shadow-[0_0_0_1px_rgba(233,193,118,0.25),0_18px_32px_rgba(0,0,0,0.24)]"
                  : "border-white/8 bg-[rgba(255,255,255,0.03)] hover:border-[#e9c176]/45 hover:bg-[rgba(255,255,255,0.045)]",
              )}
              key={option.id}
              onClick={() => onSelect(option.id)}
              type="button"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-fth-cc-display text-[1.15rem] leading-none text-[#f7e7c6]">
                      {option.title}
                    </div>
                    <TokenPill muted={selectedOptionId !== option.id}>
                      {option.mode === "gold" ? "Gold path" : "Equipment bundle"}
                    </TokenPill>
                  </div>
                  <p className="m-0 mt-2 font-fth-cc-body text-[0.92rem] leading-6 text-[#d7cdc6]">
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
    <div className="min-w-[11rem] rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-2 font-fth-cc-body text-[0.96rem] leading-6 text-[#f2ebe2]">{value}</div>
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
    <div className="rounded-[1.1rem] border border-white/8 bg-[rgba(255,255,255,0.03)] px-4 py-3">
      <MicroLabel>{label}</MicroLabel>
      <div className="mt-2 font-fth-cc-display text-[1.08rem] leading-none text-[#f7e7c6]">{value}</div>
      <p className="m-0 mt-2 font-fth-cc-body text-[0.88rem] leading-6 text-[#cfc5bd]">{description}</p>
    </div>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.22em] text-[#e9c176]/72">
      {children}
    </div>
  );
}

function ValueBadge({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[#e9c176]/24 bg-[rgba(233,193,118,0.12)] px-3 py-1 font-fth-cc-ui text-[0.64rem] uppercase tracking-[0.18em] text-[#f0d7a1]">
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
        muted
          ? "border-white/10 bg-[rgba(255,255,255,0.03)] text-[#cbc2ba]"
          : "border-[#e9c176]/24 bg-[rgba(233,193,118,0.1)] text-[#f1d9a6]",
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
        selected
          ? "border-[#e9c176] bg-[rgba(233,193,118,0.16)] text-[#f7e7c6]"
          : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#b8aea6]",
      )}
    >
      <i aria-hidden="true" className={selected ? "fa-solid fa-check" : "fa-solid fa-circle"} />
      <span className="sr-only">{selected ? "Selected" : "Not selected"}</span>
    </span>
  );
}

function EmptyPanelCopy({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 font-fth-cc-body text-[0.92rem] leading-6 text-[#cfc6be]">
      {children}
    </div>
  );
}
