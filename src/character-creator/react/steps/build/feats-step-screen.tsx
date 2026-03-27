import type { ReactNode } from "react";

import type {
  AbilityKey,
  CreatorIndexEntry,
  FeatSelection,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { ABILITY_LABELS } from "../../../data/dnd5e-constants";
import { cn } from "../../../../ui/lib/cn";

type FeatCatalogEntry = CreatorIndexEntry & {
  selected?: boolean;
};

type AbilityAttunementEntry = {
  key: AbilityKey;
  label: string;
  score: number;
  modifier: string;
  selected: boolean;
  atMax: boolean;
};

type FeatsStepViewModel = {
  choice: "asi" | "feat";
  isAsi: boolean;
  isFeat: boolean;
  abilities: AbilityAttunementEntry[];
  asiCount: number;
  maxAsiPicks: number;
  feats: FeatCatalogEntry[];
  selectedFeat?: FeatCatalogEntry | null;
  hasFeats: boolean;
  emptyMessage: string;
};

type FeatsStepSelection = FeatSelection & {
  choice: "asi" | "feat";
};

type UpdateSelection = (selection: FeatSelection, silent?: boolean) => void;

export function FeatsStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as FeatsStepViewModel | undefined;
  if (!viewModel) return null;

  const currentSelection: FeatsStepSelection = state.selections.feats ?? { choice: "asi" };
  const selectedFeat = viewModel.feats.find((entry) => entry.uuid === currentSelection.featUuid) ?? viewModel.selectedFeat ?? null;

  const updateSelection: UpdateSelection = (selection, silent = false) => {
    controller.updateCurrentStepData(selection, silent ? { silent: true } : undefined);
  };

  const toggleAbility = (abilityKey: AbilityKey) => {
    const selected = new Set(currentSelection.asiAbilities ?? []);
    if (selected.has(abilityKey)) selected.delete(abilityKey);
    else if (selected.size < 2) selected.add(abilityKey);

    updateSelection({
      ...currentSelection,
      choice: "asi",
      asiAbilities: [...selected],
    });
  };

  return (
    <ArcaneStepFrame scene="ritual">
      <ArcaneHero
        eyebrow="Build"
        title="Shape Your Ascension"
        description="Choose a feat to deepen your legend, or attune your essence through an ability score improvement."
      />

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(21rem,0.88fr)]">
        <ArcaneScrollPanel className="min-h-0 overflow-y-auto">
          <div className="flex flex-wrap gap-3">
            <ModeToggleButton
              active={viewModel.isAsi}
              label="Ability Attunement"
              onClick={() => updateSelection({
                ...currentSelection,
                choice: "asi",
                featUuid: undefined,
                featName: undefined,
                featImg: undefined,
              })}
            />
            <ModeToggleButton
              active={viewModel.isFeat}
              label="Feat Catalog"
              onClick={() => updateSelection({ ...currentSelection, choice: "feat" })}
            />
          </div>

          {viewModel.isAsi ? (
            <AsiAttunementPanel
              abilities={viewModel.abilities}
              asiCount={viewModel.asiCount}
              maxAsiPicks={viewModel.maxAsiPicks}
              onToggleAbility={toggleAbility}
            />
          ) : (
            <FeatCatalogPanel
              currentSelection={currentSelection}
              emptyMessage={viewModel.emptyMessage}
              feats={viewModel.feats}
              hasFeats={viewModel.hasFeats}
              selectedFeat={selectedFeat}
              onSelectFeat={updateSelection}
            />
          )}
        </ArcaneScrollPanel>

        <ArcaneInspectorPanel
          title={viewModel.isAsi ? "Attunement Summary" : (selectedFeat?.name ?? "Feat Details")}
          eyebrow={viewModel.isAsi ? "Ability Scores" : "Selected Feat"}
        >
          {viewModel.isAsi ? (
            <div className="space-y-3">
              <ValueBadge>{viewModel.asiCount} of {viewModel.maxAsiPicks} picks chosen</ValueBadge>
              <div className="flex flex-wrap gap-2">
                {(currentSelection.asiAbilities ?? []).length > 0 ? (currentSelection.asiAbilities ?? []).map((ability) => (
                  <TokenPill key={ability}>{ABILITY_LABELS[ability]}</TokenPill>
                )) : <TokenPill muted>Choose one or two abilities</TokenPill>}
              </div>
              <p className="font-fth-cc-body text-[0.98rem] leading-7 text-[#d7d0cb]">
                Ability attunement keeps the build grounded in your core scores. Choose one ability twice or two different abilities once each, following the existing feat/ASI rules already enforced by the creator.
              </p>
            </div>
          ) : selectedFeat ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(34,28,39,0.96),rgba(15,15,19,0.98))] shadow-[0_18px_36px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <div className="relative">
                  <img alt={selectedFeat.name} className="h-56 w-full object-cover" src={selectedFeat.img} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,9,0.08),rgba(5,5,9,0.58))]" />
                  <div className="absolute left-4 top-4">
                    <TokenPill>Selected Feat</TokenPill>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="font-fth-cc-display text-[1.4rem] leading-none text-[#f9efd8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                      {selectedFeat.name}
                    </div>
                    <div className="mt-2 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#f0d8a6]">
                      {selectedFeat.packLabel}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.15rem] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <MicroLabel>Selection State</MicroLabel>
                  <p className="m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6 text-[#d8d0ca]">
                    Bound into the build and ready to advance.
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-3">
                  <MicroLabel>Source</MicroLabel>
                  <p className="m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6 text-[#d8d0ca]">
                    {selectedFeat.packLabel}
                  </p>
                </div>
              </div>
              <p className="font-fth-cc-body text-[0.98rem] leading-7 text-[#d7d0cb]">
                The inspector keeps the selected feat visible as an artifact of the build. Use it to confirm the feat source and the card you are binding before advancing.
              </p>
            </div>
          ) : (
            <ArcaneEmptyState
              compact
              message="Choose a feat to inspect the artifact you are binding into the build."
              title="No feat selected"
            />
          )}
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

function AsiAttunementPanel({
  abilities,
  asiCount,
  maxAsiPicks,
  onToggleAbility,
}: {
  abilities: AbilityAttunementEntry[];
  asiCount: number;
  maxAsiPicks: number;
  onToggleAbility: (ability: AbilityKey) => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <MicroLabel>Attunement Picks</MicroLabel>
        <ValueBadge>{asiCount} / {maxAsiPicks}</ValueBadge>
      </div>
      {abilities.map((ability) => (
        <div
          className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.95),rgba(20,20,24,0.98))] p-4 shadow-[0_16px_30px_rgba(0,0,0,0.22)]"
          key={ability.key}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-fth-cc-display text-[1.25rem] text-[#f4e7cf]">{ability.label}</div>
              <div className="mt-1 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#a89fbe]">
                Current score {ability.score} • modifier {ability.modifier}
              </div>
            </div>
            <button
              className={cn(
                "rounded-full border px-4 py-2 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.18em] transition",
                ability.selected
                  ? "border-[#e9c176] bg-[linear-gradient(180deg,#f3d28e,#d5a84d)] text-[#38260f]"
                  : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#e4ddd8] hover:border-[#e9c176]/45",
                ability.atMax && !ability.selected && "opacity-45",
              )}
              disabled={ability.atMax && !ability.selected}
              onClick={() => onToggleAbility(ability.key)}
              type="button"
            >
              {ability.selected ? "Attuned" : ability.atMax ? "At Maximum" : "Select"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatCatalogPanel({
  currentSelection,
  emptyMessage,
  feats,
  hasFeats,
  selectedFeat,
  onSelectFeat,
}: {
  currentSelection: FeatsStepSelection;
  emptyMessage: string;
  feats: FeatCatalogEntry[];
  hasFeats: boolean;
  selectedFeat: FeatCatalogEntry | null;
  onSelectFeat: UpdateSelection;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(31,25,36,0.95),rgba(17,17,22,0.98))] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl space-y-2">
            <MicroLabel>Feat Catalog</MicroLabel>
            <h3 className="font-fth-cc-display text-[1.35rem] leading-none text-[#f7e8c9]">
              Choose a feat artifact to bind into the build
            </h3>
            <p className="font-fth-cc-body text-[0.95rem] leading-6 text-[#d5cdc7]">
              Scan the catalog, compare the source labels, and pick the feat whose identity best fits the build you are shaping.
            </p>
          </div>
          <ValueBadge>{feats.length} indexed</ValueBadge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <TokenPill muted>
            {selectedFeat ? `Selected: ${selectedFeat.name}` : "No feat selected"}
          </TokenPill>
          <TokenPill>
            {hasFeats ? "Catalog available" : "Catalog sealed"}
          </TokenPill>
        </div>
      </div>
      {hasFeats ? <div className="grid gap-3">
        {feats.map((entry) => {
        const checked = entry.uuid === currentSelection.featUuid;
        return (
          <button
            className={cn(
              "group relative overflow-hidden rounded-[1.45rem] border p-0 text-left transition",
              checked
                ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(64,42,58,0.86),rgba(22,17,28,0.98))] shadow-[0_0_0_1px_rgba(233,193,118,0.28),0_18px_36px_rgba(0,0,0,0.22)]"
                : "border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.95),rgba(20,20,24,0.98))] hover:border-[#e9c176]/45 hover:shadow-[0_12px_24px_rgba(0,0,0,0.12)]",
            )}
            key={entry.uuid}
            onClick={() => onSelectFeat({
              choice: "feat",
              featUuid: entry.uuid,
              featName: entry.name,
              featImg: entry.img,
            })}
            aria-pressed={checked}
            type="button"
          >
            <div className="grid min-h-[7.5rem] grid-cols-[6rem_minmax(0,1fr)] gap-4 p-4 md:min-h-[8.25rem] md:grid-cols-[7.25rem_minmax(0,1fr)] md:p-5">
              <div className="relative overflow-hidden rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.52))]">
                <img alt={entry.name} className="h-full w-full object-cover" src={entry.img} />
                <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(8,8,12,0.9))] px-2 py-2">
                  <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em] text-[#f1d8a4]">
                    {entry.packLabel}
                  </div>
                </div>
              </div>
              <div className="min-w-0 py-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MicroLabel>{checked ? "Selected Feat" : "Feat Artifact"}</MicroLabel>
                    <div className="mt-1 font-fth-cc-display text-[1.15rem] leading-tight text-[#f5e8cb] md:text-[1.24rem]">
                      {entry.name}
                    </div>
                  </div>
                  <SelectionSigil checked={checked} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <TokenPill muted>{entry.packLabel}</TokenPill>
                  <TokenPill>{checked ? "Bound to build" : "Select to bind"}</TokenPill>
                </div>
              </div>
            </div>
          </button>
        );
        })}
      </div> : (
        <ArcaneEmptyState
          message={emptyMessage}
          title="No feats indexed"
        />
      )}
    </div>
  );
}

function ArcaneStepFrame({
  scene,
  children,
}: {
  scene: "ritual" | "forge" | "grimoire" | "visage" | "binding";
  children: ReactNode;
}) {
  return (
    <section className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(27,27,32,0.96),rgba(16,16,20,0.99))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]", `cc-cinematic-step cc-cinematic-step--${scene}`)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(198,157,86,0.18),transparent_55%),radial-gradient(circle_at_20%_85%,rgba(91,55,114,0.16),transparent_45%)]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-5 p-5 xl:p-6">
        {children}
      </div>
    </section>
  );
}

function ArcaneHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-3 rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(48,41,52,0.78),rgba(18,18,24,0.94))] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <div className="max-w-3xl">
        <h2 className="font-fth-cc-display text-[2rem] leading-none text-[#f8edd7]">{title}</h2>
        <p className="mt-3 font-fth-cc-body text-[1rem] leading-7 text-[#d9d2cd]">{description}</p>
      </div>
    </header>
  );
}

function ArcaneScrollPanel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-[1.4rem] border border-white/10 bg-[rgba(17,17,22,0.7)] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]", className)}>
      {children}
    </div>
  );
}

function ArcaneInspectorPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex min-h-[18rem] flex-col rounded-[1.4rem] border border-[#e2c48a]/18 bg-[linear-gradient(180deg,rgba(37,30,42,0.96),rgba(16,16,22,0.98))] p-5 shadow-[0_18px_36px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <h3 className="mt-3 font-fth-cc-display text-[1.55rem] leading-none text-[#f5e7cb]">{title}</h3>
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

function ArcaneEmptyState({
  message,
  compact = false,
  title,
}: {
  message: string;
  compact?: boolean;
  title?: string;
}) {
  return (
    <div className={cn("rounded-[1.2rem] border border-dashed border-white/12 bg-[rgba(255,255,255,0.03)] px-4 py-5 text-center", compact ? "py-4" : "py-8")}>
      {title ? <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.26em] text-[#b7ab9d]">{title}</div> : null}
      <p className={cn("font-fth-cc-body text-[0.98rem] leading-7 text-[#d0c8c3]", title ? "mt-2" : "mt-0")}>{message}</p>
    </div>
  );
}

function ModeToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-full border px-4 py-2 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.24em] transition",
        active
          ? "border-[#e9c176] bg-[linear-gradient(180deg,#f3d28e,#d9ab54)] text-[#39260d] shadow-[0_10px_22px_rgba(0,0,0,0.22)]"
          : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#eadfda] hover:border-[#e9c176]/45",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.26em] text-[#b7ab9d]">{children}</div>;
}

function ValueBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-[#e2c48a]/22 bg-[rgba(246,228,193,0.08)] px-3 py-1 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.2em] text-[#f3ddae]">{children}</span>;
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
        "inline-flex items-center rounded-full border px-3 py-1 font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em]",
        muted
          ? "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#c8beb7]"
          : "border-[#e2c48a]/20 bg-[rgba(241,207,140,0.09)] text-[#f1d8a4]",
      )}
    >
      {children}
    </span>
  );
}

function SelectionSigil({ checked }: { checked: boolean }) {
  return (
    <div className={cn("grid h-10 w-10 place-items-center rounded-full border text-sm transition", checked ? "border-[#e9c176] bg-[rgba(233,193,118,0.16)] text-[#f4ddb0]" : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#d2cac4]")}>
      <i className={cn("fa-solid", checked ? "fa-check" : "fa-plus")} />
    </div>
  );
}
