import type { ReactWizardStepProps } from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";

type ClassSummaryViewModel = {
  className: string;
  classImage: string;
  classIdentifier: string;
  hitDie: string;
  startingHpPreview: number;
  usesAssignedCon: boolean;
  featureCount: number;
  chosenSkills: string[];
  chosenWeaponMasteries: string[];
  savingThrows: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  features: Array<{ title: string }>;
  hasChosenSkills: boolean;
  hasChosenWeaponMasteries: boolean;
  hasSavingThrows: boolean;
  hasArmorProficiencies: boolean;
  hasWeaponProficiencies: boolean;
  hasFeatures: boolean;
};

type SummarySectionProps = {
  eyebrow: string;
  title: string;
  accent?: boolean;
  entries: string[];
};

const CLASS_THEMES: Record<string, { frame: string; glow: string; sigil: string; badge: string }> = {
  barbarian: { frame: "#b57d4d", glow: "rgba(201,124,58,0.34)", sigil: "fa-solid fa-fire", badge: "Ashen Vanguard" },
  bard: { frame: "#be9361", glow: "rgba(216,165,103,0.3)", sigil: "fa-solid fa-music", badge: "College Virtuoso" },
  cleric: { frame: "#bca26e", glow: "rgba(212,185,104,0.3)", sigil: "fa-solid fa-sun", badge: "Sanctified Herald" },
  druid: { frame: "#96a663", glow: "rgba(123,156,82,0.34)", sigil: "fa-solid fa-leaf", badge: "Keeper Of The Wilds" },
  fighter: { frame: "#b48959", glow: "rgba(196,145,89,0.32)", sigil: "fa-solid fa-swords", badge: "Battlefield Veteran" },
  monk: { frame: "#c89f6d", glow: "rgba(215,164,104,0.34)", sigil: "fa-solid fa-hand-fist", badge: "Disciplined Adept" },
  paladin: { frame: "#d3b27b", glow: "rgba(220,190,121,0.32)", sigil: "fa-solid fa-shield-halved", badge: "Oathsworn Champion" },
  ranger: { frame: "#a8b95f", glow: "rgba(155,189,88,0.36)", sigil: "fa-solid fa-bow-arrow", badge: "Trailbound Hunter" },
  rogue: { frame: "#b08995", glow: "rgba(174,127,146,0.32)", sigil: "fa-solid fa-mask", badge: "Shadow Operative" },
  sorcerer: { frame: "#c18377", glow: "rgba(210,125,112,0.34)", sigil: "fa-solid fa-wand-sparkles", badge: "Arcane Scion" },
  warlock: { frame: "#b285bb", glow: "rgba(173,118,186,0.34)", sigil: "fa-solid fa-book-open", badge: "Pact Bearer" },
  wizard: { frame: "#7ea3d5", glow: "rgba(111,154,215,0.34)", sigil: "fa-solid fa-hat-wizard", badge: "Lorebound Magus" },
};

export function ClassSummaryStepScreen({ shellContext }: ReactWizardStepProps) {
  const viewModel = shellContext.stepViewModel as ClassSummaryViewModel | undefined;
  if (!viewModel) return null;

  const theme = getClassTheme(viewModel.classIdentifier);

  return (
    <section className="fth-react-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-3 md:px-5 md:pb-5">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="relative overflow-hidden rounded-[1.8rem] border border-fth-cc-gold/35 bg-[linear-gradient(180deg,rgba(73,49,33,0.96),rgba(24,15,10,0.98))] p-[0.32rem] shadow-[0_24px_60px_rgba(0,0,0,0.36)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,214,145,0.22),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(113,77,46,0.2),transparent_28%)]" />
          <div
            className="relative grid gap-4 overflow-hidden rounded-[1.5rem] border bg-[linear-gradient(180deg,rgba(255,248,236,0.96),rgba(228,209,181,0.95))] p-4 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:p-5"
            style={{
              borderColor: theme.frame,
              boxShadow: `inset 0 0 0 1px rgba(255,244,225,0.55), 0 0 28px ${theme.glow}`,
            }}
          >
            <div
              className="relative overflow-hidden rounded-[1.25rem] border bg-[#20130e] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.12)]"
              style={{ borderColor: theme.frame }}
            >
              {viewModel.classImage ? (
                <img
                  alt={viewModel.className}
                  className="aspect-[0.96] w-full object-cover"
                  loading="lazy"
                  src={viewModel.classImage}
                />
              ) : (
                <div className="flex aspect-[0.96] items-center justify-center bg-[radial-gradient(circle_at_35%_35%,#4e3527,#1a100c)] text-[3rem] text-fth-cc-gold-bright">
                  <i className={theme.sigil} aria-hidden="true" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,247,233,0.08),transparent_22%,transparent_65%,rgba(22,11,7,0.42))]" />
              <div className="pointer-events-none absolute inset-x-4 bottom-4 h-10 rounded-full bg-[linear-gradient(180deg,rgba(16,8,6,0),rgba(16,8,6,0.62))] blur-md" />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-[linear-gradient(180deg,rgba(62,41,28,0.94),rgba(28,17,12,0.96))] px-3 py-1.5 text-[#f4dfb5] shadow-[0_10px_20px_rgba(0,0,0,0.24)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#f2d48f] bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b67826)] text-white">
                  <i className={cn(theme.sigil, "text-xs")} aria-hidden="true" />
                </span>
                <span className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em]">{theme.badge}</span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#bb935f]/50 bg-[linear-gradient(180deg,rgba(111,75,46,0.16),rgba(111,75,46,0.06))] px-3 py-1 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#7e5536]">
                  <i className={cn(theme.sigil, "text-[0.72rem]")} aria-hidden="true" />
                  <span>Class Revelation</span>
                </div>

                <div>
                  <h2 className="m-0 font-fth-cc-display text-[2rem] uppercase tracking-[0.1em] text-[#4b3223] md:text-[2.5rem]">
                    {viewModel.className}
                  </h2>
                  <p className="mt-3 max-w-2xl font-fth-cc-body text-[1rem] leading-7 text-[#5e4637] md:text-[1.06rem]">
                    Review the signature strengths, battlefield tools, and opening talents your class brings into the
                    adventure before you move into the rest of the character journey.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroStat label="Hit Die" value={viewModel.hitDie} />
                <HeroStat
                  label="Level 1 HP"
                  note={viewModel.usesAssignedCon ? undefined : "Assuming CON 10"}
                  value={String(viewModel.startingHpPreview)}
                />
                <HeroStat label="Opening Features" value={String(viewModel.featureCount)} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {viewModel.hasChosenSkills ? (
              <SummarySection eyebrow="Trained Instincts" entries={viewModel.chosenSkills} title="Class Skills" />
            ) : null}
            {viewModel.hasSavingThrows ? (
              <SummarySection accent eyebrow="Battle Tempering" entries={viewModel.savingThrows} title="Saving Throws" />
            ) : null}
            {viewModel.hasChosenWeaponMasteries ? (
              <SummarySection eyebrow="Signature Arsenal" entries={viewModel.chosenWeaponMasteries} title="Weapon Masteries" />
            ) : null}
            {viewModel.hasArmorProficiencies ? (
              <SummarySection eyebrow="Wardings" entries={viewModel.armorProficiencies} title="Armor Proficiencies" />
            ) : null}
            {viewModel.hasWeaponProficiencies ? (
              <SummarySection eyebrow="Arms Training" entries={viewModel.weaponProficiencies} title="Weapon Proficiencies" />
            ) : null}
          </div>

          <section className="rounded-[1.45rem] border border-[#bb935f]/40 bg-[linear-gradient(180deg,rgba(255,246,230,0.96),rgba(235,217,190,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.16)]">
            <div className="flex items-start justify-between gap-3 border-b border-[#c9ab80]/45 pb-3">
              <div>
                <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#876145]">
                  First Threads Of Power
                </div>
                <h3 className="m-0 mt-1 font-fth-cc-display text-[1.45rem] uppercase tracking-[0.06em] text-[#4b3223]">
                  Features Through Starting Level
                </h3>
              </div>
              <div className="rounded-full border border-[#bb935f]/45 bg-[linear-gradient(180deg,rgba(111,75,46,0.12),rgba(111,75,46,0.04))] px-3 py-1.5 font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.18em] text-[#7f5a3d]">
                {viewModel.featureCount} unlocked
              </div>
            </div>

            {viewModel.hasFeatures ? (
              <div className="mt-4 grid gap-3">
                {viewModel.features.map((feature) => (
                  <div
                    className="flex items-start gap-3 rounded-[1.15rem] border border-[#d4bb96]/55 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-3 shadow-[0_10px_20px_rgba(69,45,24,0.08)]"
                    key={feature.title}
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d0aa6f]/75 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b77925)] text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                      <i className="fa-solid fa-sparkles text-sm" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-fth-cc-body text-[1rem] font-semibold leading-6 text-[#4c3524]">
                        {feature.title}
                      </div>
                    </div>
                  </div>
                ))}
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

function HeroStat({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-[#bb935f]/38 bg-[linear-gradient(180deg,rgba(255,251,244,0.95),rgba(242,228,203,0.92))] px-4 py-3 shadow-[0_10px_20px_rgba(69,45,24,0.08)]">
      <div className="font-fth-cc-ui text-[0.66rem] uppercase tracking-[0.18em] text-[#855b3e]">{label}</div>
      <div className="mt-2 font-fth-cc-display text-[1.65rem] uppercase tracking-[0.08em] text-[#4a3222]">{value}</div>
      {note ? <div className="mt-1 font-fth-cc-body text-sm text-[#6b5040]">{note}</div> : null}
    </div>
  );
}

function SummarySection({ eyebrow, title, accent = false, entries }: SummarySectionProps) {
  return (
    <section className="rounded-[1.45rem] border border-[#bb935f]/40 bg-[linear-gradient(180deg,rgba(255,246,230,0.96),rgba(235,217,190,0.95))] p-4 shadow-[0_18px_34px_rgba(47,29,18,0.16)]">
      <div className="border-b border-[#c9ab80]/45 pb-3">
        <div className="font-fth-cc-ui text-[0.68rem] uppercase tracking-[0.22em] text-[#876145]">{eyebrow}</div>
        <h3 className="m-0 mt-1 font-fth-cc-display text-[1.2rem] uppercase tracking-[0.06em] text-[#4b3223]">{title}</h3>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {entries.map((entry) => (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1.5 font-fth-cc-ui text-[0.7rem] uppercase tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
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
