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
            className="relative overflow-hidden rounded-[1.55rem] border border-[color:var(--fth-color-border)] bg-[image:var(--fth-theme-panel-image)] p-4 shadow-[var(--fth-theme-shadow-panel),inset_0_1px_0_color-mix(in_srgb,var(--fth-color-text)_6%,transparent)] md:p-5"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--fth-color-arcane)_14%,transparent),transparent_34%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--fth-color-accent)_14%,transparent),transparent_34%)]" />
            <div className="relative z-10 flex flex-col gap-5">
              <div className="flex flex-col gap-4 border-b border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.3em] text-[color:color-mix(in_srgb,var(--fth-color-accent)_78%,transparent)]">
                    Origins Recap
                  </div>
                  <h3 className="mt-2 font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em] text-[color:var(--fth-color-text)]">
                    Origin Summary
                  </h3>
                  <p className="mt-2 max-w-3xl font-fth-cc-body text-[0.98rem] leading-7 text-[color:var(--fth-color-text-muted)]">
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
            className="rounded-[1.45rem] border border-[color:var(--fth-color-border)] bg-[image:var(--fth-theme-panel-image-alt)] p-4 shadow-[var(--fth-theme-shadow-panel),inset_0_1px_0_color-mix(in_srgb,var(--fth-color-text)_5%,transparent)]"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            transition={{ delay: 0.03, duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-3 border-b border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--fth-color-accent)_74%,transparent)]">
                  Chapter Readiness
                </div>
                <div className="mt-1 font-fth-cc-body text-[1rem] font-semibold text-[color:var(--fth-color-text)]">
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
            <p className="mt-3 font-fth-cc-body text-[0.95rem] leading-6 text-[color:var(--fth-color-text-muted)]">
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
    <section className="relative overflow-hidden rounded-[1.28rem] border border-[color:var(--fth-color-border)] bg-[image:var(--fth-theme-card-shell-image)] shadow-[var(--fth-theme-shadow-panel)]">
      <div className="relative aspect-[1.22] overflow-hidden">
        {image ? (
          <img alt={label} className="h-full w-full object-cover" loading="lazy" src={image} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[color:var(--fth-color-accent-strong)]">
            <i className={cn(iconClass, "text-3xl")} aria-hidden="true" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-[image:var(--fth-theme-card-inner-image)]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 h-10 rounded-full bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fth-color-text)_12%,transparent),transparent)]" />
        <div className="absolute inset-x-4 bottom-4 rounded-[1rem] border border-[color:color-mix(in_srgb,var(--fth-color-accent)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--fth-color-canvas)_72%,transparent)] px-4 py-3 shadow-[0_14px_24px_rgb(0_0_0_/_0.16)] backdrop-blur-[4px]">
          <div className="font-fth-cc-ui text-[0.6rem] uppercase tracking-[0.22em] text-[color:color-mix(in_srgb,var(--fth-color-accent)_78%,transparent)]">
            {kicker}
          </div>
          <div className="mt-1 font-fth-cc-display text-[1.15rem] uppercase tracking-[0.06em] text-[color:var(--fth-color-text)]">
            {label}
          </div>
          <p className="mt-1.5 font-fth-cc-body text-[0.86rem] leading-5 text-[color:var(--fth-color-text-muted)]">
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
    <section className="rounded-[1.28rem] border border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] bg-[color:var(--fth-color-surface-glass)] p-4 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--fth-color-text)_4%,transparent)]">
      <div className="flex items-start gap-3 border-b border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--fth-color-accent)_38%,transparent)] bg-[radial-gradient(circle_at_35%_35%,color-mix(in_srgb,var(--fth-color-accent-strong)_24%,transparent),color-mix(in_srgb,var(--fth-color-accent-contrast)_66%,transparent))] text-[color:var(--fth-color-accent-strong)] shadow-[0_10px_20px_rgb(0_0_0_/_0.16)]">
          <i className={iconClass} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-fth-cc-body text-[1rem] font-semibold text-[color:var(--fth-color-text)]">{title}</div>
          <p className="mt-1 font-fth-cc-body text-[0.9rem] leading-6 text-[color:var(--fth-color-text-muted)]">{description}</p>
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
    <section className="rounded-[1.12rem] border border-[color:var(--fth-color-border)] bg-[image:var(--fth-theme-panel-image-alt)] p-4 shadow-[var(--fth-theme-shadow-panel)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--fth-color-accent)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--fth-color-accent)_10%,transparent)] text-[color:var(--fth-color-accent-strong)]">
            <i className={iconClass} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="font-fth-cc-body text-[0.96rem] font-semibold text-[color:var(--fth-color-text)]">{title}</div>
            {source ? (
              <div className="font-fth-cc-ui text-[0.58rem] uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--fth-color-accent)_72%,transparent)]">
                {source === "background" ? "Background choice" : "Species choice"}
              </div>
            ) : null}
          </div>
        </div>
        {entries.length > 0 ? (
          <span className="rounded-full border border-[color:color-mix(in_srgb,var(--fth-color-text)_8%,transparent)] bg-[color:var(--fth-color-surface-glass)] px-2.5 py-1 font-fth-cc-ui text-[0.55rem] uppercase tracking-[0.16em] text-[color:var(--fth-color-text-muted)]">
            {entries.length} item{entries.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {entries.map((entry) => (
            <span
              className="rounded-full border border-[color:color-mix(in_srgb,var(--fth-color-accent)_28%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--fth-color-accent)_18%,transparent),color-mix(in_srgb,var(--fth-color-canvas)_76%,transparent))] px-3 py-1.5 font-fth-cc-ui text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--fth-color-accent-strong)]"
              key={`${title}-${entry}`}
            >
              {entry}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 font-fth-cc-body text-[0.92rem] leading-6 text-[color:var(--fth-color-text-muted)]">
          {emptyLabel ?? "No entries recorded."}
        </div>
      )}
    </section>
  );
}

function EmptyRecapState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-[color:color-mix(in_srgb,var(--fth-color-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--fth-color-text)_3%,transparent)] px-4 py-5 font-fth-cc-body text-[color:var(--fth-color-text-muted)]">
      {message}
    </div>
  );
}
