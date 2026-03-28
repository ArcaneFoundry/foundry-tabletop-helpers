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
  wide?: boolean;
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
    <section className="cc-class-summary flex flex-col px-1 pb-2 pt-2">
      <div className="cc-class-summary__stack grid gap-4">
        <div className="cc-class-summary__intro grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="cc-class-summary__hero-shell overflow-hidden rounded-[1.6rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(37,34,42,0.98),rgba(14,15,20,0.99))] p-[0.32rem] shadow-[0_26px_48px_rgba(0,0,0,0.28)] md:p-[0.36rem]">
            <div className="rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] p-4 md:p-5">
              <div className="border-b border-white/10 pb-3">
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.26em] text-[#e9c176]/78">
                  Vocation Bound
                </div>
                <div className="mt-2 font-fth-cc-display text-[1.45rem] leading-none text-[#f5ead5] md:text-[1.8rem]">
                  {viewModel.className}
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div
                  className="relative mx-auto aspect-[1.38] w-full overflow-hidden rounded-[1.35rem] border bg-[#140f16] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.08)] md:aspect-[1.15]"
                  style={{ borderColor: `${theme.frame}aa`, boxShadow: `inset 0 0 0 1px rgba(250,229,194,0.08), 0 0 28px ${theme.glow}` }}
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
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,233,0.04),transparent_24%,rgba(8,7,12,0.06)_58%,rgba(8,7,12,0.88)_100%)]" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(14,14,18,0.7),rgba(14,14,18,0))]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
                    <div className="mx-auto max-w-2xl rounded-[1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,15,20,0.62),rgba(15,15,20,0.86))] px-4 py-3 text-center backdrop-blur-md">
                      <p className="m-0 font-fth-cc-body text-[0.95rem] italic leading-6 text-[#f0e3ce] drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)] md:text-[1rem]">
                        {viewModel.overview || `A level ${viewModel.startingLevel} ${viewModel.className.toLowerCase()} stands ready to step from calling into origin.`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="cc-class-summary__kit-column grid w-full gap-4 self-stretch">
            <section className="overflow-hidden rounded-[1.45rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.28rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)]">
              <div className="rounded-[1.18rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] p-4 text-[#f1ddbc]">
                <div className="border-b border-white/10 pb-3">
                  <div className="font-fth-cc-ui text-[0.7rem] uppercase tracking-[0.22em] text-[#e6c88f]">
                    Opening Kit
                  </div>
                </div>

                <div className="cc-class-summary__sigils mt-4 grid gap-4 md:grid-cols-2">
                  {openingKitGroups.length > 0 ? openingKitGroups.map((group) => (
                    <SelectionGroup
                      key={group.key}
                      accent={group.accent}
                      entries={group.entries}
                      iconClass={group.iconClass}
                      title={group.title}
                      wide={openingKitGroups.length === 1}
                    />
                  )) : (
                    <div className="rounded-[1rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-5 font-fth-cc-body text-[#c5bcc2]">
                      No class selections are locked in yet.
                    </div>
                  )}
                </div>

                <div className="cc-class-summary__kit-metrics mt-4 grid gap-3 border-t border-white/10 pt-4">
                  {openingKitMetrics.map((metric) => (
                    <SummaryMetric key={metric.label} label={metric.label} value={metric.value} />
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="cc-class-summary__ledger overflow-hidden rounded-[1.55rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(38,34,42,0.98),rgba(17,17,22,0.99))] p-[0.3rem] shadow-[0_22px_40px_rgba(0,0,0,0.28)] md:p-[0.32rem]">
          <section className="rounded-[1.32rem] border border-white/10 bg-[linear-gradient(180deg,rgba(33,30,37,0.98),rgba(15,15,20,0.98))] p-4 md:p-5">
            <div className="border-b border-white/10 pb-3">
              <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-[#e6c88f]">
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

            <div className="mt-6 border-b border-white/10 pb-3">
              <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.24em] text-[#e6c88f]">
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
                      className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                      key={featureKey}
                    >
                      <button
                        className="flex w-full items-start gap-3 px-5 py-4 text-left"
                        style={FEATURE_ROW_PADDING_STYLE}
                        onClick={() => setExpandedFeature(isExpanded ? null : featureKey)}
                        type="button"
                      >
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9c176]/42 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d] shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                          <i className="fa-solid fa-sparkles text-sm" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-fth-cc-body text-[1rem] font-semibold leading-6 text-[#f2e6d4]">
                            {feature.title}
                          </div>
                        </div>
                        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] text-[#cfbf9b] transition-transform duration-200">
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
                          <div className="border-t border-white/10 px-4 py-3">
                            {feature.description ? (
                              <div
                                className="fth-class-summary-description prose prose-sm max-w-none font-fth-cc-body text-[0.95rem] leading-6 text-[#c8c0cb] prose-headings:text-[#f1e6d3] prose-strong:text-[#f3e7d3] prose-p:text-[#c8c0cb] prose-li:text-[#c8c0cb]"
                                dangerouslySetInnerHTML={{ __html: feature.description }}
                              />
                            ) : (
                              <div className="font-fth-cc-body text-[0.92rem] leading-6 text-[#c5bcc2]">
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
              <div className="mt-4 rounded-[1.1rem] border border-dashed border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-5 font-fth-cc-body text-[#c5bcc2]">
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
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.2em] text-[#d8c595]">{label}</div>
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
          className="inline-flex items-center rounded-full border border-[#e9c176]/28 bg-[rgba(233,193,118,0.1)] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] text-[#f0dfbf]"
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
    <section className="cc-class-summary__card rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e9c176]/42 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d] shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em] text-[#f2e6d4]">
          {title}
        </h4>
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <span
              className="inline-flex min-h-9 items-center rounded-full border border-[#e9c176]/24 bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-left font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] leading-5 text-[#e9dcc6]"
              key={entry}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.92rem] leading-6 text-[#c5bcc2]">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function SelectionGroup({ title, iconClass, entries, accent = false, wide = false }: SelectionGroupProps) {
  return (
    <section className={cn(
      "cc-class-summary__card w-full rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[0_14px_28px_rgba(0,0,0,0.18)]",
      wide ? "lg:col-span-2" : "",
    )}>
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_8px_18px_rgba(0,0,0,0.14)]",
          accent
            ? "border-[#e9c176]/42 bg-[rgba(233,193,118,0.14)] text-[#f4e6c4]"
            : "border-[#e9c176]/42 bg-[linear-gradient(180deg,#f0ca81_0%,#8f6427_100%)] text-[#36240d]",
        )}>
          <i className={cn(iconClass, "text-sm")} aria-hidden="true" />
        </div>
        <h4 className="m-0 font-fth-cc-display text-[1rem] uppercase tracking-[0.06em] text-[#f2e6d4]">
          {title}
        </h4>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            className={cn(
              "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-left font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.14em] leading-5",
              accent
                ? "border-[#e9c176]/28 bg-[rgba(233,193,118,0.08)] text-[#f1deb8]"
                : "border-white/10 bg-[rgba(255,255,255,0.04)] text-[#e9dcc6]",
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
