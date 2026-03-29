import { buildEmptySpeciesChoicesState, getSpeciesChoiceValidationMessages, getSpeciesItemChoiceRequirements } from "../../../../steps/origin-flow-utils";
import { cn } from "../../../../../ui/lib/cn";
import {
  CompactMetaChips,
  EmptySelectionState,
  SectionHeading,
  SelectionPip,
  StatCard,
  type OriginPaneProps,
} from "../components/origin-pane-primitives";

type SpeciesItemChoicesViewModel = {
  title: string;
  description: string;
  requiredCount: number;
  validationMessages?: string[];
  itemChoiceEmptyMessage?: string;
};

type SpeciesItemChoiceRequirement = ReturnType<typeof getSpeciesItemChoiceRequirements>[number];

function getRequirementSelectionLimit(requirement: SpeciesItemChoiceRequirement): number {
  return Math.min(requirement.requiredCount, requirement.itemChoices.length);
}

export function SpeciesItemChoicesPane({ shellContext, state, controller }: OriginPaneProps) {
  const viewModel = shellContext.stepViewModel as SpeciesItemChoicesViewModel | undefined;
  const requirements = getSpeciesItemChoiceRequirements(state);
  const validationMessages = viewModel?.validationMessages ?? getSpeciesChoiceValidationMessages(state);
  const totalRequired = viewModel?.requiredCount ?? requirements.reduce((sum, requirement) => sum + getRequirementSelectionLimit(requirement), 0);
  const totalSelected = requirements.reduce(
    (sum, requirement) => sum + (requirement.selectedIds?.length ?? 0),
    0,
  );
  const speciesName = state.selections.species?.name ?? "Species";

  return (
    <div className="cc-origin-species-item-choices-pane grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(19rem,0.82fr)]">
      <section className="cc-theme-shell-inner relative isolate flex flex-col rounded-[1.45rem] border shadow-[inset_0_1px_0_color-mix(in_srgb,white_3%,transparent),0_22px_42px_color-mix(in_srgb,var(--cc-bg-base)_22%,transparent)]">
        <div className="px-4 py-4">
          <SectionHeading
            eyebrow={speciesName}
            title={viewModel?.title ?? "Choose Species Gifts"}
            description={viewModel?.description ?? ""}
          />

          <div className="cc-theme-card mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border px-4 py-3">
            <div className="min-w-0">
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.24em]">
                Grouped Requirements
              </div>
              <div className="cc-theme-body-muted mt-1 font-fth-cc-body text-[0.93rem] leading-6">
                Each group completes independently, so sparse groups can still resolve legally when fewer options exist.
              </div>
            </div>
            <CompactMetaChips
              chips={[
                `${requirements.length} section${requirements.length === 1 ? "" : "s"}`,
                `${totalSelected} / ${totalRequired} chosen`,
              ]}
              tone="dark"
            />
          </div>

          <div className="mt-4 grid gap-4">
            {requirements.length > 0 ? (
              requirements.map((requirement, index) => {
                const selectedIds = requirement.selectedIds ?? [];
                const maxCount = getRequirementSelectionLimit(requirement);
                const remaining = Math.max(0, maxCount - selectedIds.length);
                return (
                  <section
                    className="cc-origin-species-item-choices-pane__group cc-theme-panel rounded-[1.25rem] border p-4 shadow-[inset_0_1px_0_color-mix(in_srgb,white_3%,transparent)]"
                    data-species-item-choice-group={requirement.id}
                    key={requirement.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--cc-border-accent)_24%,transparent)] pb-3">
                      <div className="min-w-0 max-w-3xl">
                        <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.26em]">
                          Group {index + 1}
                        </div>
                        <div className="cc-theme-body mt-1 font-fth-cc-body text-[1rem] font-semibold">
                          {requirement.title}
                        </div>
                        <div className="cc-theme-body-muted mt-1 font-fth-cc-body text-[0.92rem] leading-6">
                          Choose up to {maxCount} option{maxCount === 1 ? "" : "s"} from this grant.
                          {maxCount < requirement.requiredCount ? " The enabled compendium data exposes fewer choices, so the group can still complete with the available options." : ""}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="cc-theme-badge--muted inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.63rem] uppercase tracking-[0.22em]">
                          {selectedIds.length} / {maxCount} selected
                        </div>
                        <CompactMetaChips
                          chips={[
                            maxCount < requirement.requiredCount ? "Sparse group allowed" : "Standard group",
                            remaining > 0 ? `${remaining} remaining` : "Requirement met",
                          ]}
                          tone="dark"
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {requirement.itemChoices.map((option) => {
                        const checked = selectedIds.includes(option.uuid);
                        const disabled = !checked && selectedIds.length >= maxCount;
                        return (
                          <button
                            aria-pressed={checked}
                            className={cn(
                              "group relative overflow-hidden rounded-[1rem] border p-3 text-left shadow-[0_12px_22px_color-mix(in_srgb,var(--cc-bg-base)_10%,transparent)] transition duration-200",
                              checked
                                ? "cc-theme-card cc-theme-card--interactive cc-theme-card--selected text-[color:var(--cc-text-primary)]"
                                : "cc-theme-card cc-theme-card--interactive text-[color:var(--cc-text-primary)]",
                              disabled && !checked && "cursor-not-allowed opacity-60",
                            )}
                            data-selected={checked ? "true" : "false"}
                            data-species-item-choice-card={option.uuid}
                            disabled={disabled}
                            key={option.uuid}
                            onClick={() => {
                              const current = new Set(state.selections.speciesChoices?.chosenItems?.[requirement.id] ?? []);
                              if (current.has(option.uuid)) current.delete(option.uuid);
                              else current.add(option.uuid);
                              state.selections.speciesChoices = {
                                ...(state.selections.speciesChoices ?? buildEmptySpeciesChoicesState(state)),
                                chosenItems: {
                                  ...(state.selections.speciesChoices?.chosenItems ?? {}),
                                  [requirement.id]: [...current],
                                },
                              };
                              void controller.refresh();
                            }}
                            type="button"
                          >
                            <div className="grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] gap-3">
                              <div className="relative aspect-square overflow-hidden rounded-[0.95rem] border border-[color:color-mix(in_srgb,var(--cc-border-accent)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--cc-bg-base)_84%,var(--cc-bg-surface)_16%)]">
                                {option.img ? (
                                  <img alt={option.name} className="h-full w-full object-cover" loading="lazy" src={option.img} />
                                ) : (
                                  <div className="cc-theme-kicker flex h-full w-full items-center justify-center">
                                    <i className="fa-solid fa-hand-sparkles" aria-hidden="true" />
                                  </div>
                                )}
                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,white_4%,transparent),color-mix(in_srgb,var(--cc-bg-base)_38%,transparent))]" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-fth-cc-body text-[0.98rem] font-semibold text-[color:var(--cc-text-primary)]">
                                      {option.name}
                                    </div>
                                    <div className={cn("mt-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]", checked ? "cc-theme-kicker" : "cc-theme-body-muted")}>
                                      {checked ? "Selected choice" : "Available choice"}
                                    </div>
                                  </div>
                                  <SelectionPip checked={checked} />
                                </div>

                                <CompactMetaChips
                                  chips={[
                                    `${selectedIds.length} / ${maxCount} chosen`,
                                    checked ? "Selected" : "Tap to choose",
                                  ]}
                                  tone={checked ? "light" : "dark"}
                                />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <EmptySelectionState message={viewModel?.itemChoiceEmptyMessage ?? "This species does not expose any item choices."} />
            )}
          </div>
        </div>
      </section>

      <aside className="grid gap-4 self-start">
        <StatCard label="Selections" value={`${totalSelected} / ${totalRequired}`} />
        <StatCard label="Groups" value={`${requirements.length}`} />
        <section className="cc-origin-species-item-choices-pane__validation cc-theme-panel rounded-[1.35rem] border p-4">
          <div className="flex items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--cc-border-accent)_24%,transparent)] pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--cc-border-accent)_70%,transparent)] bg-[radial-gradient(circle_at_35%_35%,color-mix(in_srgb,var(--cc-accent-gold)_84%,white_16%),color-mix(in_srgb,var(--cc-action-primary)_88%,var(--cc-accent-bronze)_12%))] text-white shadow-[0_8px_18px_color-mix(in_srgb,var(--cc-bg-base)_14%,transparent)]">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            </div>
            <div>
              <div className="cc-theme-body font-fth-cc-body text-[1rem] font-semibold">Validation</div>
              <div className="cc-theme-kicker font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em]">
                Compendium legality and sparse-group checks
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {validationMessages.length > 0 ? validationMessages.map((message) => (
              <div
                className="cc-theme-card cc-theme-body rounded-[1rem] border px-4 py-3 font-fth-cc-body text-[0.94rem] leading-6"
                key={message}
              >
                {message}
              </div>
            )) : (
              <div className="rounded-[1rem] border border-[color:color-mix(in_srgb,var(--cc-accent-emerald)_34%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cc-accent-emerald)_18%,transparent),color-mix(in_srgb,var(--cc-bg-surface)_82%,var(--cc-bg-base)_18%))] px-4 py-3 font-fth-cc-body text-[0.94rem] leading-6 text-[color:color-mix(in_srgb,var(--cc-accent-emerald)_64%,var(--cc-text-primary)_36%)]">
                All available species item choices are currently legal. Choose the required options to continue when you are ready.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
