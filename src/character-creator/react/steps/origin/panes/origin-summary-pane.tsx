import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { ReactWizardStepProps } from "../../../../character-creator-types";
import { cn } from "../../../../../ui/lib/cn";
import { CompactMetaChips } from "../components/origin-pane-primitives";

type OriginSummaryViewModel = {
  className: string;
  backgroundName: string;
  backgroundImage: string;
  speciesName: string;
  speciesImage: string;
  fixedLanguages: string[];
  selectedGrantGroups: Array<{
    id: string;
    title: string;
    iconClass: string;
    entries: string[];
    source?: "background" | "species";
  }>;
  backgroundSkills: string[];
  speciesTraits: string[];
  speciesSkills: string[];
  speciesItems: string[];
  toolProficiency: string | null;
  originFeatName: string | null;
};

type OriginSummaryPaneProps = Pick<ReactWizardStepProps, "shellContext">;

export function OriginSummaryPane({ shellContext }: OriginSummaryPaneProps) {
  const viewModel = shellContext.stepViewModel as OriginSummaryViewModel | undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  if (!viewModel) return null;

  const fixedGrantSections = [
    {
      id: "fixed-languages",
      title: "Fixed Languages",
      iconClass: "fa-solid fa-language",
      entries: viewModel.fixedLanguages,
      emptyLabel: "No fixed languages recorded.",
    },
    {
      id: "background-skills",
      title: "Background Skills",
      iconClass: "fa-solid fa-book-sparkles",
      entries: viewModel.backgroundSkills,
      emptyLabel: "No background proficiencies recorded.",
    },
    {
      id: "species-traits",
      title: "Species Traits",
      iconClass: "fa-solid fa-dna",
      entries: viewModel.speciesTraits,
      emptyLabel: "No species traits recorded.",
    },
  ].filter((section) => section.entries.length > 0);

  const chapterOutcomeChips = [
    viewModel.className ? `${viewModel.className} path confirmed` : "",
    viewModel.originFeatName ? "Origin feat prepared" : "",
    `${viewModel.selectedGrantGroups.length} flexible grant${viewModel.selectedGrantGroups.length === 1 ? "" : "s"}`,
  ].filter(Boolean);

  return (
    <section className="flex flex-col px-1 pb-2 pt-2">
      <div className="grid gap-4 pr-1">
          <motion.section
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[1.55rem] border border-[#e9c176]/18 bg-[linear-gradient(180deg,rgba(23,22,28,0.98),rgba(10,10,14,0.995))] p-4 shadow-[inset_0_1px_0_rgba(255,243,219,0.05),0_28px_60px_rgba(0,0,0,0.3)] md:p-5"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(211,190,235,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(233,193,118,0.12),transparent_34%)]" />
            <div className="relative z-10 flex flex-col gap-5">
              <div className="flex flex-col gap-4 border-b border-white/8 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em] text-[#e9c176]/78">
                    Origins Recap
                  </div>
                  <h3 className="mt-2 font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em] text-[#f5ead5]">
                    Origin Summary
                  </h3>
                  <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.98rem] leading-7 text-[#d4cdd7]">
                    Review the lineage, background, and chapter grants now bound to this character before you leave Origins
                    and step into the build phase.
                  </p>
                </div>
                <CompactMetaChips chips={chapterOutcomeChips} tone="dark" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <OriginHeroAnchor
                      image={viewModel.backgroundImage}
                      iconClass="fa-solid fa-scroll"
                      kicker="Background"
                      label={viewModel.backgroundName}
                      sublabel="The life and training that shaped the character's first gifts."
                    />
                    <OriginHeroAnchor
                      image={viewModel.speciesImage}
                      iconClass="fa-solid fa-dna"
                      kicker="Species"
                      label={viewModel.speciesName}
                      sublabel="The lineage and inherited traits carried into the campaign."
                    />
                  </div>

                  <RecapPanel
                    description="These grants are fixed by your chosen background and species, and they form the stable foundation of the chapter."
                    iconClass="fa-solid fa-shield-halved"
                    title="Fixed Origin Grants"
                  >
                    <div className="grid gap-3 lg:grid-cols-2">
                      {fixedGrantSections.map((section) => (
                        <DarkSummaryCard
                          emptyLabel={section.emptyLabel}
                          entries={section.entries}
                          iconClass={section.iconClass}
                          key={section.id}
                          title={section.title}
                        />
                      ))}
                      {viewModel.toolProficiency ? (
                        <DarkSummaryCard
                          entries={[viewModel.toolProficiency]}
                          iconClass="fa-solid fa-screwdriver-wrench"
                          title="Tool Proficiency"
                        />
                      ) : null}
                    </div>
                  </RecapPanel>
                </div>

                <aside className="grid gap-4 self-start">
                  <RecapPanel
                    description="The feat chosen in Origins sets the first clear expression of the character's approach to power."
                    iconClass="fa-solid fa-stars"
                    title="Origin Feat"
                  >
                    <DarkSummaryCard
                      emptyLabel="No origin feat confirmed."
                      entries={viewModel.originFeatName ? [viewModel.originFeatName] : []}
                      iconClass="fa-solid fa-stars"
                      title="Confirmed Feat"
                    />
                  </RecapPanel>

                  <RecapPanel
                    description="Flexible grants collect the choices you made across languages, skill picks, and species-specific options."
                    iconClass="fa-solid fa-wand-sparkles"
                    title="Chosen Origin Grants"
                  >
                    <div className="grid gap-3">
                      {viewModel.selectedGrantGroups.length > 0 ? (
                        viewModel.selectedGrantGroups.map((group) => (
                          <DarkSummaryCard
                            emptyLabel={`No selections recorded for ${group.title}.`}
                            entries={group.entries}
                            iconClass={group.iconClass}
                            key={group.id}
                            source={group.source}
                            title={group.title}
                          />
                        ))
                      ) : (
                        <EmptyRecapState message="No flexible origin selections were recorded." />
                      )}
                    </div>
                  </RecapPanel>
                </aside>
              </div>
            </div>
          </motion.section>

          <motion.section
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            className="rounded-[1.45rem] border border-[#e9c176]/16 bg-[linear-gradient(180deg,rgba(21,20,25,0.94),rgba(11,11,15,0.985))] p-4 shadow-[inset_0_1px_0_rgba(255,243,219,0.04),0_20px_42px_rgba(0,0,0,0.22)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            transition={{ delay: 0.03, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-3 border-b border-white/8 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[#e9c176]/74">
                  Chapter Readiness
                </div>
                <div className="mt-1 font-fth-cc-body text-[1rem] font-semibold text-[#f6e8cc]">
                  Origins is ready to hand off into Build.
                </div>
              </div>
              <CompactMetaChips
                chips={[
                  viewModel.backgroundName,
                  viewModel.speciesName,
                  viewModel.originFeatName ?? "Origin feat pending",
                ]}
                tone="dark"
              />
            </div>
            <p className="mt-3 font-fth-cc-body text-[0.95rem] leading-6 text-[#cbc4ce]">
              Confirm this recap when you are satisfied. The next chapter will treat these origin decisions as the foundation
              for equipment, spells, and the rest of the build choices that follow.
            </p>
          </motion.section>
      </div>
    </section>
  );
}

function OriginHeroAnchor({
  kicker,
  label,
  sublabel,
  image,
  iconClass,
}: {
  kicker: string;
  label: string;
  sublabel: string;
  image: string;
  iconClass: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.28rem] border border-[#e9c176]/22 bg-[linear-gradient(180deg,rgba(33,25,21,0.96),rgba(13,11,12,0.99))] shadow-[0_20px_36px_rgba(0,0,0,0.26)]">
      <div className="relative aspect-[1.22] overflow-hidden">
        {image ? (
          <img alt={label} className="h-full w-full object-cover" loading="lazy" src={image} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#f0d2a6]">
            <i className={cn(iconClass, "text-3xl")} aria-hidden="true" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(251,240,215,0.08),transparent_20%,transparent_52%,rgba(10,7,7,0.12)_70%,rgba(8,7,9,0.94)_100%)]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 h-10 rounded-full bg-[linear-gradient(180deg,rgba(255,240,213,0.12),rgba(255,240,213,0))]" />
        <div className="absolute inset-x-4 bottom-4 rounded-[1rem] border border-[#efd29a]/30 bg-[linear-gradient(180deg,rgba(17,11,10,0.18),rgba(10,8,9,0.82))] px-4 py-3 shadow-[0_14px_24px_rgba(0,0,0,0.2)] backdrop-blur-[4px]">
          <div className="font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.22em] text-[#d5b98a]">
            {kicker}
          </div>
          <div className="mt-1 font-fth-cc-display text-[1.15rem] uppercase tracking-[0.06em] text-[#f7e5bf]">
            {label}
          </div>
          <p className="mt-1.5 font-fth-cc-body text-[0.86rem] leading-5 text-[#f0dcc1]">
            {sublabel}
          </p>
        </div>
      </div>
    </section>
  );
}

function RecapPanel({
  iconClass,
  title,
  description,
  children,
}: {
  iconClass: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.28rem] border border-white/8 bg-[rgba(255,255,255,0.025)] p-4 shadow-[inset_0_1px_0_rgba(255,248,233,0.04)]">
      <div className="flex items-start gap-3 border-b border-white/8 pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e9c176]/38 bg-[radial-gradient(circle_at_35%_35%,rgba(248,218,154,0.22),rgba(95,60,22,0.76))] text-[#f5ddae] shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
          <i className={iconClass} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-fth-cc-body text-[1rem] font-semibold text-[#f6e8cc]">{title}</div>
          <p className="mt-1 font-fth-cc-body text-[0.9rem] leading-6 text-[#cbc4ce]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DarkSummaryCard({
  title,
  iconClass,
  entries,
  emptyLabel,
  source,
}: {
  title: string;
  iconClass: string;
  entries: string[];
  emptyLabel?: string;
  source?: "background" | "species";
}) {
  return (
    <section className="rounded-[1.12rem] border border-[#e9c176]/14 bg-[linear-gradient(180deg,rgba(24,21,24,0.98),rgba(12,11,14,0.995))] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9c176]/34 bg-[rgba(233,193,118,0.08)] text-[#f5ddae]">
            <i className={iconClass} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-fth-cc-body text-[0.96rem] font-semibold text-[#f4e6cb]">{title}</div>
            {source ? (
              <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[#c9b18b]">
                {source === "background" ? "Background choice" : "Species choice"}
              </div>
            ) : null}
          </div>
        </div>
        {entries.length > 0 ? (
          <span className="rounded-full border border-white/8 bg-[rgba(255,255,255,0.03)] px-2.5 py-1 font-fth-cc-ui text-[0.55rem] uppercase tracking-[0.16em] text-[#cfc3c6]">
            {entries.length} item{entries.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <span
              className="rounded-full border border-[#e9c176]/26 bg-[linear-gradient(180deg,rgba(58,44,33,0.72),rgba(24,19,19,0.92))] px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.16em] text-[#f5ddae]"
              key={`${title}-${entry}`}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.92rem] leading-6 text-[#bdb4bf]">
          {emptyLabel ?? "No entries recorded."}
        </div>
      )}
    </section>
  );
}

function EmptyRecapState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-[#e9c176]/26 bg-[rgba(255,255,255,0.02)] px-4 py-5 font-fth-cc-body text-[#cbc4ce]">
      {message}
    </div>
  );
}
