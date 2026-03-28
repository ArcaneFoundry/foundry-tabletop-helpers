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
      <section className="relative isolate flex flex-col rounded-[1.45rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(23,21,28,0.98),rgba(12,12,16,0.99))] shadow-[inset_0_1px_0_rgba(255,248,233,0.03),0_22px_42px_rgba(0,0,0,0.22)]">
        <div className="px-4 py-4">
          <SectionHeading
            eyebrow={speciesName}
            title={viewModel?.title ?? "Choose Species Gifts"}
            description={viewModel?.description ?? ""}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-[#e9c176]/[0.14] bg-[rgba(255,255,255,0.03)] px-4 py-3">
            <div className="min-w-0">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.24em] text-[#e9c176]/78">
                Grouped Requirements
              </div>
              <div className="mt-1 font-fth-cc-body text-[0.93rem] leading-6 text-[#d0cad0]">
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
                    className="cc-origin-species-item-choices-pane__group rounded-[1.25rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(31,26,24,0.98),rgba(18,15,15,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,240,219,0.03),0_18px_34px_rgba(0,0,0,0.18)]"
                    data-species-item-choice-group={requirement.id}
                    key={requirement.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e9c176]/[0.12] pb-3">
                      <div className="min-w-0 max-w-3xl">
                        <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.26em] text-[#e9c176]/72">
                          Group {index + 1}
                        </div>
                        <div className="mt-1 font-fth-cc-body text-[1rem] font-semibold text-[#f5ead5]">
                          {requirement.title}
                        </div>
                        <div className="mt-1 font-fth-cc-body text-[0.92rem] leading-6 text-[#d0cad0]">
                          Choose up to {maxCount} option{maxCount === 1 ? "" : "s"} from this grant.
                          {maxCount < requirement.requiredCount ? " The enabled compendium data exposes fewer choices, so the group can still complete with the available options." : ""}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="inline-flex whitespace-nowrap rounded-full border border-[#e9c176]/[0.16] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 font-fth-cc-ui text-[0.63rem] uppercase tracking-[0.22em] text-[#c6c0cb]">
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
                              "group relative overflow-hidden rounded-[1rem] border p-3 text-left shadow-[0_12px_22px_rgba(67,43,23,0.08)] transition duration-200 hover:brightness-[1.03]",
                              checked
                                ? "border-[#e9c176]/58 bg-[linear-gradient(180deg,rgba(239,224,184,0.96),rgba(214,184,117,0.92))] text-[#4c3524]"
                                : "border-[#8f7256] bg-[linear-gradient(180deg,rgba(42,31,24,0.98),rgba(22,16,14,0.99))] text-[#f3e3c7]",
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
                              <div className="relative aspect-square overflow-hidden rounded-[0.95rem] border border-[#d4bb96]/60 bg-[#20130e]">
                                {option.img ? (
                                  <img alt={option.name} className="h-full w-full object-cover" loading="lazy" src={option.img} />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
                                    <i className="fa-solid fa-hand-sparkles" aria-hidden="true" />
                                  </div>
                                )}
                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,233,0.02),rgba(6,6,8,0.46))]" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className={cn("font-fth-cc-body text-[0.98rem] font-semibold", checked ? "text-[#4c3524]" : "text-[#f3e3c7]")}>
                                      {option.name}
                                    </div>
                                    <div className={cn("mt-1 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.18em]", checked ? "text-[#7b5a3e]" : "text-[#ad9ba7]")}>
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
        <section className="cc-origin-species-item-choices-pane__validation rounded-[1.35rem] border border-[#e9c176]/[0.14] bg-[linear-gradient(180deg,rgba(24,20,18,0.96),rgba(15,13,12,0.99))] p-4 shadow-[0_16px_28px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-3 border-b border-[#e9c176]/[0.14] pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d0aa6f]/75 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b77925)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
            </div>
            <div>
              <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f5ead5]">Validation</div>
              <div className="font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.22em] text-[#e9c176]/72">
                Compendium legality and sparse-group checks
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            {validationMessages.length > 0 ? validationMessages.map((message) => (
              <div
                className="rounded-[1rem] border border-[#d6b57a]/36 bg-[linear-gradient(180deg,rgba(255,247,231,0.06),rgba(246,231,198,0.03))] px-4 py-3 font-fth-cc-body text-[0.94rem] leading-6 text-[#d0cad0]"
                key={message}
              >
                {message}
              </div>
            )) : (
              <div className="rounded-[1rem] border border-[#87a36a]/35 bg-[linear-gradient(180deg,rgba(27,41,26,0.72),rgba(16,24,17,0.86))] px-4 py-3 font-fth-cc-body text-[0.94rem] leading-6 text-[#d2e1c0]">
                All available species item choices are currently legal. Choose the required options to continue when you are ready.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
