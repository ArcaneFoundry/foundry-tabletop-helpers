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
        <ArcaneScrollPanel className="min-h-0">
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
              <p className="cc-theme-copy font-fth-cc-body text-[0.98rem] leading-7">
                Ability attunement keeps the build grounded in your core scores. Choose one ability twice or two different abilities once each, following the existing feat/ASI rules already enforced by the creator.
              </p>
            </div>
          ) : selectedFeat ? (
            <div className="space-y-4">
              <div className="cc-theme-panel cc-theme-panel--soft overflow-hidden rounded-[1.35rem]">
                <div className="relative">
                  <img alt={selectedFeat.name} className="h-56 w-full object-cover" src={selectedFeat.img} />
                  <div className="cc-theme-media-frame__fade absolute inset-0" />
                  <div className="absolute left-4 top-4">
                    <TokenPill>Selected Feat</TokenPill>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="cc-theme-title font-fth-cc-display text-[1.4rem] leading-none">
                      {selectedFeat.name}
                    </div>
                    <div className="cc-theme-kicker mt-2 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em]">
                      {selectedFeat.packLabel}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="cc-theme-card cc-theme-card--soft rounded-[1.15rem] px-4 py-3">
                  <MicroLabel>Selection State</MicroLabel>
                  <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
                    Bound into the build and ready to advance.
                  </p>
                </div>
                <div className="cc-theme-card cc-theme-card--soft rounded-[1.15rem] px-4 py-3">
                  <MicroLabel>Source</MicroLabel>
                  <p className="cc-theme-body-muted m-0 mt-2 font-fth-cc-body text-[0.94rem] leading-6">
                    {selectedFeat.packLabel}
                  </p>
                </div>
              </div>
              <p className="cc-theme-copy font-fth-cc-body text-[0.98rem] leading-7">
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
    <section className="cc-theme-panel rounded-[1.35rem] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <MicroLabel>Choose your rite</MicroLabel>
          <p className="cc-theme-body-muted mt-2 font-fth-cc-body text-[0.92rem] leading-6">
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
      <div className="cc-theme-panel rounded-[1.35rem] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <MicroLabel>Attunement field</MicroLabel>
            <h4 className="cc-theme-title mt-2 font-fth-cc-display text-[1.38rem] leading-none">
              Bind up to two abilities to the build
            </h4>
            <p className="cc-theme-body-muted mt-2 max-w-2xl font-fth-cc-body text-[0.96rem] leading-6">
              Choose one ability twice or two different abilities once each. The ritual stays grounded in the same feat and ASI rules the creator already enforces.
            </p>
          </div>
          <div className="cc-theme-panel cc-theme-panel--accent min-w-[9rem] rounded-[1rem] px-4 py-3 text-right">
            <ValueBadge>{asiCount} / {maxAsiPicks}</ValueBadge>
            <div className="cc-theme-progress-track mt-3 h-2 rounded-full">
              <div
                className="cc-theme-progress-fill h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="cc-theme-kicker mt-2 font-fth-cc-ui text-[0.65rem] uppercase tracking-[0.22em]">
              {remaining > 0 ? `${remaining} choice${remaining === 1 ? "" : "s"} remain` : "Attunement complete"}
            </div>
          </div>
        </div>
      </div>

      {abilities.map((ability) => (
        <div
          className={cn(
            "cc-theme-card cc-theme-card--raised rounded-[1.35rem] p-4 transition",
            !ability.selected && "cc-theme-card--soft",
            ability.selected && "cc-theme-card--selected",
          )}
          key={ability.key}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="cc-theme-title font-fth-cc-display text-[1.25rem]">{ability.label}</div>
                <TokenPill muted={!ability.selected && !ability.atMax}>
                  {ability.selected ? "Attuned" : ability.atMax ? "At max" : "Available"}
                </TokenPill>
              </div>
              <div className="cc-theme-kicker mt-2 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em]">
                Current score {ability.score} • modifier {ability.modifier}
              </div>
              <p className="cc-theme-body-muted mt-3 max-w-2xl font-fth-cc-body text-[0.94rem] leading-6">
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
                "cc-theme-toggle",
                ability.selected && "cc-theme-toggle--active",
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
      <div className="cc-theme-panel rounded-[1.35rem] px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl space-y-2">
            <MicroLabel>Feat Catalog</MicroLabel>
            <h3 className="cc-theme-title font-fth-cc-display text-[1.35rem] leading-none">
              Choose a feat artifact to bind into the build
            </h3>
            <p className="cc-theme-body-muted font-fth-cc-body text-[0.95rem] leading-6">
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
              "cc-theme-card cc-theme-card--raised group relative overflow-hidden rounded-[1.45rem] p-0 text-left transition",
              !checked && "cc-theme-card--interactive",
              checked && "cc-theme-card--selected",
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
              <div className="cc-theme-media-frame relative overflow-hidden rounded-[1rem]">
                <img alt={entry.name} className="h-full w-full object-cover" src={entry.img} />
                <div className="cc-theme-media-frame__fade absolute inset-x-0 bottom-0 px-2 py-2">
                  <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.2em]">
                    {entry.packLabel}
                  </div>
                </div>
              </div>
              <div className="min-w-0 py-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <MicroLabel>{checked ? "Selected Feat" : "Feat Artifact"}</MicroLabel>
                    <div className="cc-theme-title mt-1 font-fth-cc-display text-[1.15rem] leading-tight md:text-[1.24rem]">
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
    <section className={cn("cc-theme-shell-inner relative flex flex-col rounded-[1.45rem]", `cc-cinematic-step cc-cinematic-step--${scene}`)}>
      <div className="cc-theme-hero-shell absolute inset-0" />
      <div className="relative z-10 flex flex-col gap-5 p-5 xl:p-6">
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
    <header className="cc-theme-header cc-theme-header--hero space-y-3 rounded-[1.35rem] px-5 py-4">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <div className="max-w-3xl">
        <h2 className="cc-theme-title font-fth-cc-display text-[2rem] leading-none">{title}</h2>
        <p className="cc-theme-copy mt-3 font-fth-cc-body text-[1rem] leading-7">{description}</p>
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
    <div className={cn("cc-theme-panel cc-theme-panel--soft rounded-[1.4rem] p-4", className)}>
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
    <aside className="cc-theme-panel cc-theme-panel--accent flex min-h-[18rem] flex-col rounded-[1.4rem] p-5">
      {eyebrow ? <MicroLabel>{eyebrow}</MicroLabel> : null}
      <h3 className="cc-theme-title mt-3 font-fth-cc-display text-[1.55rem] leading-none">{title}</h3>
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
    <div className={cn("cc-theme-empty rounded-[1.2rem] border border-dashed px-4 py-5 text-center", compact ? "py-4" : "py-8")}>
      {title ? <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.26em]">{title}</div> : null}
      <p className={cn("cc-theme-body-muted font-fth-cc-body text-[0.98rem] leading-7", title ? "mt-2" : "mt-0")}>{message}</p>
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
        "cc-theme-toggle",
        active && "cc-theme-toggle--active",
      )}
      onClick={onClick}
      type="button"
    >
      <div className={cn("cc-theme-icon-chip grid h-10 w-10 shrink-0 place-items-center rounded-full border transition", active && "cc-theme-icon-chip--active")}>
        <i className={cn("fa-solid text-[0.95rem] transition", icon)} />
      </div>
      <div className="min-w-0">
        <div className="font-fth-cc-ui text-[0.72rem] uppercase tracking-[0.22em]">{label}</div>
        <div className="cc-theme-body-muted mt-1 max-w-[18rem] font-fth-cc-body text-[0.82rem] leading-5">
          {subtitle}
        </div>
      </div>
    </button>
  );
}

function MicroLabel({ children }: { children: ReactNode }) {
  return <div className="cc-theme-kicker font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.26em]">{children}</div>;
}

function ValueBadge({ children }: { children: ReactNode }) {
  return <span className="cc-theme-badge inline-flex items-center rounded-full px-3 py-1 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.2em]">{children}</span>;
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
        muted ? "cc-theme-pill--muted" : "cc-theme-pill",
      )}
    >
      {children}
    </span>
  );
}

function SelectionSigil({ checked }: { checked: boolean }) {
  return (
    <div className={cn("cc-theme-sigil grid h-10 w-10 place-items-center rounded-full border text-sm transition", checked && "cc-theme-sigil--selected")}>
      <i className={cn("fa-solid", checked ? "fa-check" : "fa-plus")} />
    </div>
  );
}
