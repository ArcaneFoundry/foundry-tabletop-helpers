import { useState } from "react";
import type { ReactWizardStepProps } from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";

type ClassSummaryViewModel = {
  className: string;
  classImage: string;
  classIdentifier: string;
  overview: string;
  primaryAbilitySummary: string;
  startingLevel: number;
  hitDie: string;
  featureCount: number;
  chosenSkills: string[];
  chosenWeaponMasteries: string[];
  savingThrows: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  selectedGrantGroups: Array<{
    id: string;
    title: string;
    iconClass: string;
    entries: string[];
  }>;
  features: Array<{ title: string; description: string }>;
  hasChosenSkills: boolean;
  hasChosenWeaponMasteries: boolean;
  hasSavingThrows: boolean;
  hasArmorProficiencies: boolean;
  hasWeaponProficiencies: boolean;
  hasToolProficiencies: boolean;
  hasFeatures: boolean;
};

type SelectionGroupProps = {
  title: string;
  iconClass: string;
  entries: string[];
  accent?: boolean;
};

const CLASS_THEMES: Record<string, { frame: string; glow: string; sigil: string }> = {
  barbarian: { frame: "#b57d4d", glow: "rgba(201,124,58,0.34)", sigil: "fa-solid fa-fire" },
  bard: { frame: "#be9361", glow: "rgba(216,165,103,0.3)", sigil: "fa-solid fa-music" },
  cleric: { frame: "#bca26e", glow: "rgba(212,185,104,0.3)", sigil: "fa-solid fa-sun" },
  druid: { frame: "#96a663", glow: "rgba(123,156,82,0.34)", sigil: "fa-solid fa-leaf" },
  fighter: { frame: "#b48959", glow: "rgba(196,145,89,0.32)", sigil: "fa-solid fa-swords" },
  monk: { frame: "#c89f6d", glow: "rgba(215,164,104,0.34)", sigil: "fa-solid fa-hand-fist" },
  paladin: { frame: "#d3b27b", glow: "rgba(220,190,121,0.32)", sigil: "fa-solid fa-shield-halved" },
  ranger: { frame: "#a8b95f", glow: "rgba(155,189,88,0.36)", sigil: "fa-solid fa-bow-arrow" },
  rogue: { frame: "#b08995", glow: "rgba(174,127,146,0.32)", sigil: "fa-solid fa-mask" },
  sorcerer: { frame: "#c18377", glow: "rgba(210,125,112,0.34)", sigil: "fa-solid fa-wand-sparkles" },
  warlock: { frame: "#b285bb", glow: "rgba(173,118,186,0.34)", sigil: "fa-solid fa-book-open" },
  wizard: { frame: "#7ea3d5", glow: "rgba(111,154,215,0.34)", sigil: "fa-solid fa-hat-wizard" },
};

export function ClassSummaryStepScreen({ shellContext }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ClassSummaryViewModel | undefined;
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  if (!viewModel) return null;

  const theme = getClassTheme(viewModel.classIdentifier);
  const openingKitGroups = [
    { key: "skills", title: "Skills Chosen", iconClass: "fa-solid fa-list-check", entries: viewModel.chosenSkills },
    { key: "masteries", title: "Weapon Masteries", iconClass: "fa-solid fa-swords", entries: viewModel.chosenWeaponMasteries, accent: true },
  ].filter((group) => group.entries.length > 0);

  return (
    <section className="fth-react-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-2 pt-2">
      <div className="grid gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
          <section className="rounded-[1.5rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)] md:p-5">
            <div className="border-b border-[#cfb58f]/55 pb-3">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
                {viewModel.className}
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div
                className="relative mx-auto aspect-square w-full max-w-[75%] overflow-hidden rounded-[1.25rem] border bg-[#20130e] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.12)]"
                style={{ borderColor: theme.frame, boxShadow: `inset 0 0 0 1px rgba(250,229,194,0.12), 0 0 22px ${theme.glow}` }}
              >
                {viewModel.classImage ? (
                  <img
                    alt={viewModel.className}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={viewModel.classImage}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_35%,#4e3527,#1a100c)] text-[3rem] text-fth-cc-gold-bright">
                    <i className={theme.sigil} aria-hidden="true" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,233,0.06),transparent_28%,transparent_64%,rgba(22,11,7,0.72))]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-center">
                  <p className="m-0 font-fth-cc-body text-[0.92rem] italic leading-6 text-[#fff2dd] drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] md:text-[0.98rem]">
                    "{viewModel.overview || `A level ${viewModel.startingLevel} ${viewModel.className.toLowerCase()} ready for the next stage of character creation.`}"
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <SummaryMetric label="Hit Die" value={viewModel.hitDie} />
                <SummaryMetric label="Saving Throws" value={viewModel.savingThrows.join(" / ")} />
                {viewModel.primaryAbilitySummary ? (
                  <SummaryMetric label="Prime Attribute" value={viewModel.primaryAbilitySummary} />
                ) : null}
              </div>
            </div>
          </section>

          <aside className="grid gap-4 self-start">
            <section className="rounded-[1.5rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)]">
              <div className="border-b border-[#cfb58f]/55 pb-3">
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
                  Opening Kit
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                {openingKitGroups.length > 0 ? openingKitGroups.map((group) => (
                  <SelectionGroup
                    key={group.key}
                    accent={group.accent}
                    entries={group.entries}
                    iconClass={group.iconClass}
                    title={group.title}
                  />
                )) : (
                  <div className="rounded-[1.1rem] border border-dashed border-[#c7aa80]/65 bg-[rgba(255,250,241,0.7)] px-4 py-5 font-fth-cc-body text-[#6b5040]">
                    No class selections are locked in yet.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <section className="rounded-[1.5rem] border border-[#c9ab80]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.95),rgba(239,224,198,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.12)] md:p-5">
          <section className="rounded-[1.5rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] p-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
            <div className="border-b border-[#cfb58f]/55 pb-3">
              <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#876145]">
                Abilities Summary
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <SummaryListCard
                emptyLabel="No weapon proficiencies listed."
                entries={viewModel.weaponProficiencies}
                iconClass="fa-solid fa-swords"
                title="Weapon Proficiencies"
              />
              <SummaryListCard
                emptyLabel="No armor training listed."
                entries={viewModel.armorProficiencies}
                iconClass="fa-solid fa-shield-halved"
                title="Armor Training"
              />
              <SummaryListCard
                emptyLabel="No tool proficiencies listed."
                entries={viewModel.toolProficiencies}
                iconClass="fa-solid fa-screwdriver-wrench"
                title="Tool Proficiencies"
              />
              {viewModel.selectedGrantGroups.map((group) => (
                <SummaryListCard
                  emptyLabel={`No selections recorded for ${group.title}.`}
                  entries={group.entries}
                  iconClass={group.iconClass}
                  key={group.id}
                  title={group.title}
                />
              ))}
            </div>

            {viewModel.hasFeatures ? (
              <div className="mt-4 grid gap-3">
                {viewModel.features.map((feature) => {
                  const featureKey = feature.title;
                  const isExpanded = expandedFeature === featureKey;

                  return (
                    <div
                      className="overflow-hidden rounded-[1.15rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] shadow-[0_10px_20px_rgba(69,45,24,0.08)]"
                      key={featureKey}
                    >
                      <button
                        className="flex w-full items-start gap-3 px-4 py-3 text-left"
                        onClick={() => setExpandedFeature(isExpanded ? null : featureKey)}
                        type="button"
                      >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d0aa6f]/75 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b77925)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                          <i className="fa-solid fa-sparkles text-sm" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-fth-cc-body text-[1rem] font-semibold leading-6 text-[#4c3524]">
                            {feature.title}
                          </div>
                        </div>
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#d9bd95]/65 bg-[rgba(255,252,246,0.72)] text-[#7a5a41] transition-transform duration-200">
                          <i
                            aria-hidden="true"
                            className={cn(
                              "fa-solid fa-chevron-down text-[0.72rem] transition-transform duration-200",
                              isExpanded ? "rotate-180" : "",
                            )}
                          />
                        </div>
                      </button>

                      <div
                        className={cn(
                          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                          isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-[#d7c09d]/55 px-4 py-3">
                            {feature.description ? (
                              <div
                                className="fth-class-summary-description prose prose-sm max-w-none font-fth-cc-body text-[0.95rem] leading-6 text-[#5e4637]"
                                dangerouslySetInnerHTML={{ __html: feature.description }}
                              />
                            ) : (
                              <div className="font-fth-cc-body text-[0.92rem] leading-6 text-[#6b5040]">
                                No feature description is available in the current compendium data.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.1rem] border border-dashed border-[#c7aa80]/65 bg-[rgba(255,250,241,0.7)] px-4 py-5 font-fth-cc-body text-[#6b5040]">
                No class features are unlocked at the current starting level.
              </div>
            )}
          </section>
        </section>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-[#bb935f]/38 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-3 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#855b3e]">{label}</div>
      <MetricValuePills value={value} />
    </div>
  );
}

function MetricValuePills({ value }: { value: string }) {
  const values = value.split("/").map((entry) => entry.trim()).filter(Boolean);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {values.map((entry) => (
        <span
          className="inline-flex items-center rounded-full border border-[#a06f47]/55 bg-[linear-gradient(180deg,rgba(220,188,141,0.95),rgba(189,151,104,0.95))] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#4b3020] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          key={entry}
        >
          {entry}
        </span>
      ))}
    </div>
  );
}

function SummaryListCard({
  title,
  iconClass,
  entries,
  emptyLabel,
}: {
  title: string;
  iconClass: string;
  entries: string[];
  emptyLabel: string;
}) {
  return (
    <section className="rounded-[1.25rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] p-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="flex items-center gap-3 border-b border-[#d7c09d]/55 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#caa976] bg-[radial-gradient(circle_at_35%_35%,#f4d8a5,#996635)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em] text-[#4b3223]">
          {title}
        </h4>
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <span
              className="inline-flex items-center rounded-full border border-[#c9aa80]/60 bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(242,228,203,0.94))] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#5a4030] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              key={entry}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.92rem] leading-6 text-[#6b5040]">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function SelectionGroup({ title, iconClass, entries, accent = false }: SelectionGroupProps) {
  return (
    <section className="rounded-[1.25rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] p-4 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="flex items-center gap-3 border-b border-[#d7c09d]/55 pb-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]",
          accent
            ? "border-[#c69f60] bg-[radial-gradient(circle_at_35%_35%,#f7d691,#a96721)]"
            : "border-[#caa976] bg-[radial-gradient(circle_at_35%_35%,#f4d8a5,#996635)]",
        )}>
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em] text-[#4b3223]">
          {title}
        </h4>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
              accent
                ? "border-[#a06f47]/55 bg-[linear-gradient(180deg,rgba(220,188,141,0.95),rgba(189,151,104,0.95))] text-[#4b3020]"
                : "border-[#c9aa80]/60 bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(242,228,203,0.94))] text-[#5a4030]",
            )}
            key={entry}
          >
            {entry}
          </span>
        ))}
      </div>
    </section>
  );
}

function getClassTheme(identifier: string) {
  return CLASS_THEMES[identifier.trim().toLowerCase()] ?? CLASS_THEMES.fighter;
}
