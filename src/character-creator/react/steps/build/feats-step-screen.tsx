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
          <ModeRail
            activeChoice={viewModel.choice}
            onChooseAsi={() => updateSelection({
              ...currentSelection,
              choice: "asi",
              featUuid: undefined,
              featName: undefined,
              featImg: undefined,
            })}
            onChooseFeat={() => updateSelection({ ...currentSelection, choice: "feat" })}
          />

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
              <img alt={selectedFeat.name} className="h-56 w-full rounded-[1.25rem] object-cover" src={selectedFeat.img} />
              <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#a89fbe]">{selectedFeat.packLabel}</div>
              <div className="font-fth-cc-display text-[1.3rem] text-[#f4e7cf]">{selectedFeat.name}</div>
            </div>
          ) : (
            <ArcaneEmptyState message="Choose a feat to inspect the artifact you are binding into the build." compact />
          )}
        </ArcaneInspectorPanel>
      </div>
    </ArcaneStepFrame>
  );
}

function ModeRail({
  activeChoice,
  onChooseAsi,
  onChooseFeat,
}: {
  activeChoice: "asi" | "feat";
  onChooseAsi: () => void;
  onChooseFeat: () => void;
}) {
  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(42,36,47,0.82),rgba(19,19,24,0.95))] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MicroLabel>Choose your rite</MicroLabel>
          <p className="mt-2 font-fth-cc-body text-[0.92rem] leading-6 text-[#cdc4bf]">
            Decide whether this level sharpens your core or binds a feat into your story.
          </p>
        </div>
        <ValueBadge>{activeChoice === "asi" ? "Ability attunement" : "Feat binding"}</ValueBadge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ModeToggleButton
          active={activeChoice === "asi"}
          icon="fa-wand-sparkles"
          label="Ability Attunement"
          subtitle="Refine the scores that define your build."
          onClick={onChooseAsi}
        />
        <ModeToggleButton
          active={activeChoice === "feat"}
          icon="fa-star"
          label="Feat Catalog"
          subtitle="Bind a legendary boon into the path."
          onClick={onChooseFeat}
        />
      </div>
    </section>
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
  const remaining = Math.max(maxAsiPicks - asiCount, 0);
  const progress = maxAsiPicks > 0 ? Math.min(100, (asiCount / maxAsiPicks) * 100) : 0;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.96),rgba(20,20,24,0.98))] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <MicroLabel>Attunement field</MicroLabel>
            <h4 className="mt-2 font-fth-cc-display text-[1.38rem] leading-none text-[#f4e7cf]">
              Bind up to two abilities to the build
            </h4>
            <p className="mt-2 max-w-2xl font-fth-cc-body text-[0.96rem] leading-6 text-[#cdc4bf]">
              Choose one ability twice or two different abilities once each. The ritual stays grounded in the same feat and ASI rules the creator already enforces.
            </p>
          </div>
          <div className="min-w-[9rem] rounded-[1rem] border border-[#e2c48a]/18 bg-[rgba(246,228,193,0.08)] px-4 py-3 text-right">
            <ValueBadge>{asiCount} / {maxAsiPicks}</ValueBadge>
            <div className="mt-3 h-2 rounded-full bg-[rgba(255,255,255,0.07)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#f3d28e,#d5a84d)] transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 font-fth-cc-ui text-[0.65rem] uppercase tracking-[0.22em] text-[#d9cda7]">
              {remaining > 0 ? `${remaining} choice${remaining === 1 ? "" : "s"} remain` : "Attunement complete"}
            </div>
          </div>
        </div>
      </div>

      {abilities.map((ability) => (
        <div
          className={cn(
            "rounded-[1.35rem] border p-4 shadow-[0_16px_30px_rgba(0,0,0,0.22)] transition",
            ability.selected
              ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(66,46,29,0.96),rgba(32,22,17,0.98))] shadow-[0_0_0_1px_rgba(233,193,118,0.22),0_18px_36px_rgba(0,0,0,0.25)]"
              : "border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.96),rgba(20,20,24,0.98))]",
          )}
          key={ability.key}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="font-fth-cc-display text-[1.25rem] text-[#f4e7cf]">{ability.label}</div>
                <TokenPill muted={!ability.selected && !ability.atMax}>
                  {ability.selected ? "Attuned" : ability.atMax ? "At max" : "Available"}
                </TokenPill>
              </div>
              <div className="mt-2 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#a89fbe]">
                Current score {ability.score} • modifier {ability.modifier}
              </div>
              <p className="mt-3 max-w-2xl font-fth-cc-body text-[0.94rem] leading-6 text-[#d5cec8]">
                {ability.selected
                  ? "This ability is already carrying part of your attunement."
                  : ability.atMax
                    ? "This score already sits at its cap, so it cannot take another attunement unless it is already selected."
                    : "Select this score to bind one of your two attunement choices here."}
              </p>
            </div>
            <button
              className={cn(
                "inline-flex items-center justify-center gap-2 self-start rounded-full border px-4 py-2 font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.18em] transition lg:self-center",
                ability.selected
                  ? "border-[#e9c176] bg-[linear-gradient(180deg,#f3d28e,#d5a84d)] text-[#38260f] shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
                  : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#e4ddd8] hover:border-[#e9c176]/45 hover:bg-[rgba(246,228,193,0.07)]",
                ability.atMax && !ability.selected && "opacity-45",
              )}
              disabled={ability.atMax && !ability.selected}
              onClick={() => onToggleAbility(ability.key)}
              type="button"
            >
              <i className={cn("fa-solid", ability.selected ? "fa-check" : "fa-wand-sparkles")} />
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
  onSelectFeat,
}: {
  currentSelection: FeatsStepSelection;
  emptyMessage: string;
  feats: FeatCatalogEntry[];
  hasFeats: boolean;
  onSelectFeat: UpdateSelection;
}) {
  return (
    <div className="mt-5 grid gap-3">
      {hasFeats ? feats.map((entry) => {
        const checked = entry.uuid === currentSelection.featUuid;
        return (
          <button
            className={cn(
              "group relative overflow-hidden rounded-[1.35rem] border p-3 text-left transition",
              checked
                ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(70,45,67,0.86),rgba(28,22,34,0.96))] shadow-[0_0_0_1px_rgba(233,193,118,0.28),0_18px_36px_rgba(0,0,0,0.22)]"
                : "border-white/10 bg-[linear-gradient(180deg,rgba(33,33,38,0.95),rgba(20,20,24,0.98))] hover:border-[#e9c176]/45",
            )}
            key={entry.uuid}
            onClick={() => onSelectFeat({
              choice: "feat",
              featUuid: entry.uuid,
              featName: entry.name,
              featImg: entry.img,
            })}
            type="button"
          >
            <div className="grid grid-cols-[4.7rem_minmax(0,1fr)_auto] items-center gap-3">
              <img alt={entry.name} className="h-[4.7rem] w-[4.7rem] rounded-[1rem] object-cover" src={entry.img} />
              <div className="min-w-0">
                <div className="font-fth-cc-display text-[1.2rem] text-[#f4e7cf]">{entry.name}</div>
                <div className="mt-2 font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#a89fbe]">
                  {entry.packLabel}
                </div>
              </div>
              <SelectionSigil checked={checked} />
            </div>
          </button>
        );
      }) : <ArcaneEmptyState message={emptyMessage} />}
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

function ArcaneEmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-[1.2rem] border border-dashed border-white/12 bg-[rgba(255,255,255,0.03)] px-4 py-5 text-center", compact ? "py-4" : "py-8")}>
      <p className="font-fth-cc-body text-[0.98rem] leading-7 text-[#d0c8c3]">{message}</p>
    </div>
  );
}

function ModeToggleButton({
  active,
  icon,
  label,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "group flex min-h-[5rem] items-center gap-3 rounded-[1.15rem] border px-4 py-3 text-left transition",
        active
          ? "border-[#e9c176] bg-[linear-gradient(180deg,rgba(243,210,142,0.94),rgba(217,171,84,0.9))] text-[#39260d] shadow-[0_10px_22px_rgba(0,0,0,0.22)]"
          : "border-white/12 bg-[rgba(255,255,255,0.04)] text-[#eadfda] hover:border-[#e9c176]/45 hover:bg-[rgba(246,228,193,0.06)]",
      )}
      onClick={onClick}
      type="button"
    >
      <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border transition", active ? "border-[#533c18]/30 bg-[rgba(56,38,15,0.18)]" : "border-white/12 bg-[rgba(255,255,255,0.04)]")}>
        <i className={cn("fa-solid text-[0.95rem] transition", active ? "text-[#5a3f17]" : "text-[#d8cfc9]", icon)} />
      </div>
      <div className="min-w-0">
        <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]">{label}</div>
        <div className="mt-1 max-w-[18rem] font-fth-cc-body text-[0.82rem] leading-5 text-[#d8cfc9]/72">
          {subtitle}
        </div>
      </div>
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
