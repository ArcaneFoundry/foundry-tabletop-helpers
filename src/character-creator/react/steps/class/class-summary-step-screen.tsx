import { useState, type CSSProperties } from "react";

import type { ReactWizardStepProps } from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";

type ClassSummaryViewModel = {
  className: string;
  classImage: string;
  classIdentifier: string;
  overview: string;
  primaryAbilitySummary: string;
  startingLevel: number;
  featureHeading: string;
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

const FEATURE_ROW_PADDING_STYLE = { paddingBlock: "1rem", paddingInline: "1.25rem" } as const;

export function ClassSummaryStepScreen({ shellContext }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ClassSummaryViewModel | undefined;
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  if (!viewModel) return null;

  const theme = getClassTheme(viewModel.classIdentifier);
  const themeStyle = {
    "--cc-class-frame": theme.frame,
    "--cc-class-glow": theme.glow,
  } as CSSProperties;
  const openingKitGroups = [
    { key: "skills", title: "Skills Chosen", iconClass: "fa-solid fa-list-check", entries: viewModel.chosenSkills },
    { key: "masteries", title: "Weapon Masteries", iconClass: "fa-solid fa-swords", entries: viewModel.chosenWeaponMasteries, accent: true },
  ].filter((group) => group.entries.length > 0);
  const openingKitMetrics = [
    { label: "Hit Die", value: viewModel.hitDie },
    { label: "Saving Throws", value: viewModel.savingThrows.join(" / ") },
    ...(viewModel.primaryAbilitySummary ? [{ label: "Prime Attribute", value: viewModel.primaryAbilitySummary }] : []),
  ];

  return (
    <section className="cc-class-summary flex flex-col px-1 pb-2 pt-2" style={themeStyle}>
      <div className="cc-class-summary__stack grid gap-4">
        <div className="cc-class-summary__intro grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="cc-class-summary__hero-shell cc-class-summary__shell overflow-hidden rounded-[1.6rem] border p-[0.24rem] md:p-[0.3rem]">
            <div className="cc-class-summary__surface rounded-[1.35rem] border p-[0.75rem] md:p-[0.9rem]">
              <div className="border-b border-[color:var(--cc-border-subtle)] pb-2">
                <div className="cc-class-summary__section-label font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.26em]">
                  Vocation Bound
                </div>
                <div className="cc-class-summary__heading mt-1.5 font-fth-cc-display text-[1.4rem] leading-none md:text-[1.7rem]">
                  {viewModel.className}
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5">
                <div className="cc-class-summary__image-frame relative mx-auto aspect-[2.05] w-full overflow-hidden rounded-[1.35rem] border md:aspect-[1.78]">
                  {viewModel.classImage ? (
                    <img
                      alt={viewModel.className}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={viewModel.classImage}
                    />
                  ) : (
                    <div className="cc-class-summary__image-fallback flex h-full w-full items-center justify-center text-[3rem]">
                      <i className={theme.sigil} aria-hidden="true" />
                    </div>
                  )}
                  <div className="cc-class-summary__image-top-sheen pointer-events-none absolute inset-0" />
                  <div className="cc-class-summary__image-vignette pointer-events-none absolute inset-x-0 top-0 h-24" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                    <div className="cc-class-summary__image-copy mx-auto max-w-2xl rounded-[1rem] border px-4 py-2.5 text-center backdrop-blur-md">
                      <p className="cc-class-summary__copy m-0 font-fth-cc-body text-[0.9rem] italic leading-5 md:text-[0.96rem]">
                        {viewModel.overview || `A level ${viewModel.startingLevel} ${viewModel.className.toLowerCase()} stands ready to step from calling into origin.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="cc-class-summary__kit-column grid w-full gap-4 self-stretch">
            <section className="cc-class-summary__shell overflow-hidden rounded-[1.45rem] border p-[0.28rem]">
              <div className="cc-class-summary__surface rounded-[1.18rem] border p-4">
                <div className="border-b border-[color:var(--cc-border-subtle)] pb-3">
                  <div className="cc-class-summary__section-label font-fth-cc-ui text-[0.7rem] uppercase tracking-[0.22em]">
                    Opening Kit
                  </div>
                </div>

                <div className="cc-class-summary__sigils mt-4 grid gap-4">
                  {openingKitGroups.length > 0 ? openingKitGroups.map((group) => (
                    <SelectionGroup
                      key={group.key}
                      accent={group.accent}
                      entries={group.entries}
                      iconClass={group.iconClass}
                      title={group.title}
                    />
                  )) : (
                    <div className="cc-class-summary__empty-state rounded-[1rem] border border-dashed px-4 py-5 font-fth-cc-body">
                      No class selections are locked in yet.
                    </div>
                  )}
                </div>

                <div className="cc-class-summary__kit-metrics mt-4 grid gap-3 border-t border-[color:var(--cc-border-subtle)] pt-4">
                  {openingKitMetrics.map((metric) => (
                    <SummaryMetric key={metric.label} label={metric.label} value={metric.value} />
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="cc-class-summary__ledger cc-class-summary__shell overflow-hidden rounded-[1.55rem] border p-[0.3rem] md:p-[0.32rem]">
          <section className="cc-class-summary__surface rounded-[1.32rem] border p-4 md:p-5">
            <div className="border-b border-[color:var(--cc-border-subtle)] pb-3">
              <div className="cc-class-summary__section-label font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]">
                Class Summary
              </div>
            </div>

            <div className="cc-class-summary__ledger-grid mt-4 grid gap-3">
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

            <div className="mt-6 border-b border-[color:var(--cc-border-subtle)] pb-3">
              <div className="cc-class-summary__section-label font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em]">
                {viewModel.featureHeading}
              </div>
            </div>

            {viewModel.hasFeatures ? (
              <div className="cc-class-summary__feature-list mt-4 grid gap-3">
                {viewModel.features.map((feature) => {
                  const featureKey = feature.title;
                  const isExpanded = expandedFeature === featureKey;

                  return (
                    <div
                      className="cc-class-summary__summary-card overflow-hidden rounded-[1.15rem] border"
                      key={featureKey}
                    >
                      <button
                        className="cc-class-summary__feature-row flex w-full items-start gap-3 px-5 py-4 text-left"
                        style={FEATURE_ROW_PADDING_STYLE}
                        onClick={() => setExpandedFeature(isExpanded ? null : featureKey)}
                        type="button"
                      >
                        <div className="cc-class-summary__summary-icon mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
                          <i className="fa-solid fa-sparkles text-sm" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="cc-class-summary__heading font-fth-cc-body text-[1rem] font-semibold leading-6">
                            {feature.title}
                          </div>
                        </div>
                        <div className="cc-class-summary__feature-toggle mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition-transform duration-200">
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
                          <div className="cc-class-summary__feature-body border-t px-4 py-3">
                            {feature.description ? (
                              <div
                                className="cc-class-summary__feature-prose fth-class-summary-description prose prose-sm max-w-none font-fth-cc-body text-[0.95rem] leading-6"
                                dangerouslySetInnerHTML={{ __html: feature.description }}
                              />
                            ) : (
                              <div className="cc-class-summary__copy font-fth-cc-body text-[0.92rem] leading-6">
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
              <div className="cc-class-summary__empty-state mt-4 rounded-[1.1rem] border border-dashed px-4 py-5 font-fth-cc-body">
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
    <div className="cc-class-summary__metric-card flex items-center justify-between gap-3 rounded-[1.15rem] border px-4 py-3">
      <div className="cc-class-summary__metric-label font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.2em]">{label}</div>
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
          className="cc-class-summary__metric-pill cc-class-summary__metric-pill--accent inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em]"
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
    <section className="cc-class-summary__card cc-class-summary__summary-card rounded-[1.25rem] border p-4">
      <div className="flex items-center gap-3 border-b border-[color:var(--cc-border-subtle)] pb-3">
        <div className="cc-class-summary__summary-icon flex h-10 w-10 items-center justify-center rounded-full border">
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="cc-class-summary__heading m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em]">
          {title}
        </h4>
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <span
              className="cc-class-summary__entry-pill inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-left font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] leading-5"
              key={entry}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="cc-class-summary__copy mt-3 font-fth-cc-body text-[0.92rem] leading-6">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function SelectionGroup({ title, iconClass, entries, accent = false }: SelectionGroupProps) {
  return (
    <section className={cn(
      "cc-class-summary__card cc-class-summary__summary-card w-full rounded-[1.25rem] border p-4",
    )}>
      <div className="flex items-center gap-3 border-b border-[color:var(--cc-border-subtle)] pb-3">
        <div className={cn(
          "cc-class-summary__summary-icon flex h-10 w-10 items-center justify-center rounded-full border",
          accent
            ? "cc-class-summary__summary-icon--accent"
            : "",
        )}>
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="cc-class-summary__heading m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em]">
          {title}
        </h4>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            className={cn(
              "cc-class-summary__entry-pill inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-left font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] leading-5",
              accent
                ? "cc-class-summary__entry-pill--accent"
                : "",
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
