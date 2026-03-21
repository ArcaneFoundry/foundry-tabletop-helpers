import { useEffect, useMemo, useState } from "react";

import type {
  ClassSelection,
  CreatorIndexEntry,
  ReactWizardStepProps,
} from "../../../character-creator-types";
import { cn } from "../../../../ui/lib/cn";
import { buildClassSelectionFromEntry, getClassStepViewModel } from "../../../steps/step-class-model";

type ClassStepViewModel = Awaited<ReturnType<typeof getClassStepViewModel>>;
type ClassEntryViewModel = ClassStepViewModel["entries"][number];

const CLASS_PROGRESS_STEPS = [
  { id: "class", label: "Class", icon: "fa-solid fa-shield-halved" },
  { id: "classChoices", label: "Skills", icon: "fa-solid fa-hand-sparkles" },
  { id: "classSummary", label: "Features", icon: "fa-solid fa-stars" },
  { id: "review", label: "Review", icon: "fa-solid fa-scroll" },
] as const;

const CLASS_THEMES: Record<string, { ribbon: string; frame: string; glow: string; crest: string }> = {
  barbarian: { ribbon: "from-[#714126] to-[#382015]", frame: "#b57d4d", glow: "rgba(201,124,58,0.35)", crest: "fa-solid fa-fire" },
  bard: { ribbon: "from-[#6e4934] to-[#302018]", frame: "#be9361", glow: "rgba(216,165,103,0.3)", crest: "fa-solid fa-music" },
  cleric: { ribbon: "from-[#665b3b] to-[#2f2819]", frame: "#bca26e", glow: "rgba(212,185,104,0.3)", crest: "fa-solid fa-sun" },
  druid: { ribbon: "from-[#46562f] to-[#202715]", frame: "#96a663", glow: "rgba(123,156,82,0.34)", crest: "fa-solid fa-leaf" },
  fighter: { ribbon: "from-[#5f4431] to-[#2a1c14]", frame: "#b48959", glow: "rgba(196,145,89,0.32)", crest: "fa-solid fa-swords" },
  monk: { ribbon: "from-[#74543a] to-[#352316]", frame: "#c89f6d", glow: "rgba(215,164,104,0.34)", crest: "fa-solid fa-hand-fist" },
  paladin: { ribbon: "from-[#625342] to-[#2a221a]", frame: "#d3b27b", glow: "rgba(220,190,121,0.32)", crest: "fa-solid fa-shield-halved" },
  ranger: { ribbon: "from-[#4f5f2f] to-[#233015]", frame: "#a8b95f", glow: "rgba(155,189,88,0.36)", crest: "fa-solid fa-bow-arrow" },
  rogue: { ribbon: "from-[#4f4447] to-[#241d1f]", frame: "#b08995", glow: "rgba(174,127,146,0.32)", crest: "fa-solid fa-mask" },
  sorcerer: { ribbon: "from-[#74413c] to-[#341b17]", frame: "#c18377", glow: "rgba(210,125,112,0.34)", crest: "fa-solid fa-wand-sparkles" },
  warlock: { ribbon: "from-[#5c3d5f] to-[#29182a]", frame: "#b285bb", glow: "rgba(173,118,186,0.34)", crest: "fa-solid fa-book-open" },
  wizard: { ribbon: "from-[#3f506a] to-[#1a2230]", frame: "#7ea3d5", glow: "rgba(111,154,215,0.34)", crest: "fa-solid fa-hat-wizard" },
};

export function ClassStepScreen({ shellContext, state, controller }: ReactWizardStepProps) {
  const initialViewModel = shellContext.stepViewModel as ClassStepViewModel | undefined;

  const [entries, setEntries] = useState<ClassEntryViewModel[]>(initialViewModel?.entries ?? []);
  const [emptyMessage, setEmptyMessage] = useState(
    initialViewModel?.emptyMessage ?? "No classes available. Check your GM configuration.",
  );

  useEffect(() => {
    let cancelled = false;

    void getClassStepViewModel(state).then((viewModel: ClassStepViewModel) => {
      if (cancelled) return;
      setEntries(viewModel.entries);
      setEmptyMessage(viewModel.emptyMessage);
    });

    return () => {
      cancelled = true;
    };
  }, [state]);

  const selectedUuid = (state.selections.class as ClassSelection | undefined)?.uuid ?? null;
  const hasEntries = entries.length > 0;
  const visibleSteps = useMemo(() => buildProgressSteps(shellContext.steps), [shellContext.steps]);

  const onSelectEntry = async (entry: CreatorIndexEntry) => {
    const selection = await buildClassSelectionFromEntry(state, entry);

    controller.updateCurrentStepData(selection, { silent: true });
    setEntries((currentEntries) => currentEntries.map((candidate) => ({
      ...candidate,
      selected: candidate.uuid === entry.uuid,
    })));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-fth-cc-gold/45 bg-[linear-gradient(180deg,rgba(249,237,216,0.98),rgba(236,219,191,0.98))] p-[0.35rem] shadow-[0_24px_60px_rgba(0,0,0,0.34)]">
        <div className="absolute inset-[0.35rem] rounded-[1.45rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.5),transparent_28%),linear-gradient(180deg,rgba(255,248,236,0.98),rgba(232,214,187,0.98))]" />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-[#b78d56]/55 bg-[linear-gradient(180deg,rgba(255,250,241,0.92),rgba(236,220,197,0.96))] shadow-[inset_0_0_0_1px_rgba(255,245,226,0.72)]">
          <header className="mx-2 mt-2 rounded-[1.15rem] border border-fth-cc-gold/50 bg-[linear-gradient(180deg,#4d3426_0%,#2f2018_52%,#231710_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,236,206,0.18),0_8px_20px_rgba(0,0,0,0.2)] md:px-6">
            <div className="flex items-center justify-center">
              <h2 className="m-0 font-fth-cc-display text-[1.65rem] uppercase tracking-[0.12em] text-fth-cc-gold-bright md:text-[2.25rem]">
                Choose Your Class
              </h2>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-4 pt-3 md:px-6">
            <ProgressRail steps={visibleSteps} />

            {hasEntries ? (
              <div className="fth-react-scrollbar mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
                <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {entries.map((entry) => (
                    <ClassCard
                      entry={entry}
                      key={entry.uuid}
                      onSelect={onSelectEntry}
                      selected={selectedUuid === entry.uuid}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState message={emptyMessage} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressRail({
  steps,
}: {
  steps: Array<{ id: string; label: string; icon: string; active: boolean; status: string }>;
}) {
  return (
    <nav
      aria-label="Class Selection Progress"
      className="mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-2 border-b border-[#bea37d]/55 pb-3 text-[#5e4330]"
    >
      {steps.map((step, index) => (
        <div className="flex items-center gap-2" key={step.id}>
          {index === 0 ? <span className="h-px w-7 bg-[#c7ab83]/70 md:w-9" /> : null}
          <span
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-[inset_0_1px_0_rgba(255,245,226,0.75)] md:h-10 md:w-10 md:text-base",
              step.active
                ? "border-[#99631f] bg-[radial-gradient(circle_at_35%_30%,#f7d691,#b77925)] text-white"
                : step.status === "complete"
                  ? "border-[#7d5a2a] bg-[linear-gradient(180deg,#d7c29b,#b89b69)] text-[#4c3524]"
                  : "border-[#c7ab83] bg-[linear-gradient(180deg,#f5ebdc,#e3d0b3)] text-[#6b4d37]",
            )}
            title={step.label}
          >
            <span className="sr-only">{step.label}</span>
            <i className={step.icon} aria-hidden="true" />
          </span>
          {index < steps.length - 1 ? (
            <span className="h-px w-6 bg-[#c7ab83]/70 md:w-8" />
          ) : (
            <span className="h-px w-7 bg-[#c7ab83]/70 md:w-9" />
          )}
        </div>
      ))}
    </nav>
  );
}

function ClassCard({
  entry,
  onSelect,
  selected,
}: {
  entry: ClassEntryViewModel;
  onSelect: (entry: CreatorIndexEntry) => Promise<void>;
  selected: boolean;
}) {
  const theme = getClassTheme(entry.name);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[0.95rem] border border-[#6e4b30] bg-[linear-gradient(180deg,#6e4b31_0%,#3f291d_9%,#241711_100%)] p-[0.22rem] text-left shadow-[0_18px_34px_rgba(66,40,21,0.36)] transition duration-200",
        "hover:-translate-y-1 hover:brightness-[1.04] hover:shadow-[0_24px_40px_rgba(66,40,21,0.42)]",
        selected &&
          "border-[#d4b06c] shadow-[0_0_0_2px_rgba(212,176,108,0.45),0_0_28px_rgba(212,176,108,0.3),0_24px_42px_rgba(64,37,20,0.46)]",
      )}
    >
      <button
        aria-pressed={selected}
        className="block w-full rounded-[0.8rem] text-left"
        onClick={() => void onSelect(entry)}
        type="button"
      >
        <div className="pointer-events-none absolute inset-[0.2rem] rounded-[0.78rem] border border-[#d9b074]/22 shadow-[inset_0_1px_0_rgba(255,240,219,0.14)]" />
        <div className="pointer-events-none absolute inset-x-[0.42rem] top-[0.32rem] h-6 rounded-full bg-[linear-gradient(180deg,rgba(255,244,216,0.22),rgba(255,244,216,0))]" />
        <div
          className={cn(
            "absolute inset-x-1 top-1 z-10 rounded-[0.72rem_0.72rem_0.25rem_0.25rem] border border-[#a27747]/65 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,235,204,0.24),0_4px_10px_rgba(0,0,0,0.18)]",
            `bg-gradient-to-b ${theme.ribbon}`,
          )}
        >
          <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-[rgba(255,238,207,0.52)]" />
          <div className="pointer-events-none absolute left-1 top-1 h-3 w-3 rounded-tl-[0.4rem] border-l border-t border-[#e1bc79]/55" />
          <div className="pointer-events-none absolute right-1 top-1 h-3 w-3 rounded-tr-[0.4rem] border-r border-t border-[#e1bc79]/55" />
          <div className="font-fth-cc-display text-center text-[1.05rem] uppercase tracking-[0.04em] text-[#f7e5bf] md:text-[1.2rem]">
            {entry.name}
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-[0.72rem] border bg-[#20130e] pt-[2.9rem] shadow-[inset_0_0_0_1px_rgba(250,229,194,0.12),inset_0_-16px_24px_rgba(0,0,0,0.2)]"
          style={{
            borderColor: theme.frame,
            boxShadow: selected
              ? `inset 0 0 0 1px rgba(250,229,194,0.12), inset 0 -16px 24px rgba(0,0,0,0.2), 0 0 34px ${theme.glow}`
              : undefined,
          }}
        >
          <div className="aspect-[0.84] overflow-hidden">
            <img
              alt={entry.name}
              className={cn(
                "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
                selected && "scale-[1.03]",
              )}
              loading="lazy"
              src={entry.cardImg}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-[0.72rem] bg-[linear-gradient(180deg,rgba(255,247,233,0.08)_0%,transparent_18%,transparent_58%,rgba(26,12,8,0.22)_100%)] shadow-[inset_0_0_0_1px_rgba(240,209,153,0.45)]" />
          <div className="pointer-events-none absolute inset-x-4 bottom-3 h-7 rounded-full bg-[linear-gradient(180deg,rgba(16,8,6,0),rgba(16,8,6,0.48))] blur-md" />
          <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 rounded-tl-[0.5rem] border-l border-t" style={{ borderColor: theme.frame }} />
          <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 rounded-tr-[0.5rem] border-r border-t" style={{ borderColor: theme.frame }} />
          <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 rounded-bl-[0.5rem] border-b border-l" style={{ borderColor: theme.frame }} />
          <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 rounded-br-[0.5rem] border-b border-r" style={{ borderColor: theme.frame }} />
          <div className="pointer-events-none absolute inset-y-[3.35rem] left-0 w-5 bg-[linear-gradient(90deg,rgba(0,0,0,0.28),rgba(0,0,0,0))]" />
          <div className="pointer-events-none absolute inset-y-[3.35rem] right-0 w-5 bg-[linear-gradient(270deg,rgba(0,0,0,0.24),rgba(0,0,0,0))]" />
          <div className="pointer-events-none absolute inset-x-3 bottom-3">
            <div className="flex max-w-[80%] flex-col gap-1.5">
              <InfoChip
                icon="fa-solid fa-dice-d20"
                label={`Hit Die ${entry.hitDie}`}
                value={entry.hitDie}
              />
              <InfoChip
                icon="fa-solid fa-star"
                label={`Primary Abilities ${entry.primaryAbilityText}`}
                value={entry.primaryAbilityBadgeText}
              />
              <InfoChip
                icon="fa-solid fa-shield"
                label={`Saving Throws ${entry.savingThrowText}`}
                value={entry.savingThrowBadgeText}
              />
            </div>
          </div>
          {selected ? (
            <div className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#f2d48f]/70 bg-[radial-gradient(circle_at_35%_35%,rgba(247,214,145,0.95),rgba(182,120,38,0.92))] text-white shadow-[0_6px_12px_rgba(0,0,0,0.24)]">
              <i className={cn(theme.crest, "text-[0.8rem]")} aria-hidden="true" />
            </div>
          ) : null}
          {selected ? (
            <div className="pointer-events-none absolute inset-0 rounded-[0.72rem] shadow-[inset_0_0_30px_rgba(245,214,137,0.28)]" />
          ) : null}
        </div>
      </button>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  if (!value) return null;

  return (
    <span
      aria-label={label}
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 self-start rounded-full border border-[#efd29a]/60 bg-[linear-gradient(180deg,rgba(35,22,15,0.55),rgba(22,14,10,0.86))] px-2 py-1 font-fth-cc-ui text-[0.56rem] uppercase tracking-[0.14em] text-[#f6deb0] shadow-[0_8px_16px_rgba(0,0,0,0.2)] backdrop-blur-[2px]"
    >
      <i className={cn(icon, "shrink-0 text-[0.7rem] text-[#f7d691]")} aria-hidden="true" />
      <span className="min-w-0 truncate">{value}</span>
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-2xl rounded-[1.2rem] border border-[#c0a27b]/65 bg-[linear-gradient(180deg,rgba(249,240,224,0.98),rgba(233,215,190,0.98))] px-8 py-10 text-center shadow-[0_14px_30px_rgba(108,72,38,0.12)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#ba8e5d]/65 bg-[radial-gradient(circle_at_35%_35%,#f7d691,#b67826)] text-white shadow-lg">
          <i className="fa-solid fa-triangle-exclamation text-xl" aria-hidden="true" />
        </div>
        <p className="font-fth-cc-display text-[1.55rem] uppercase tracking-[0.08em] text-[#4c3524]">
          No Classes Available
        </p>
        <p className="mt-3 font-fth-cc-body text-[1.1rem] leading-7 text-[#5f4738]">{message}</p>
      </div>
    </div>
  );
}

function getClassTheme(name: string) {
  return CLASS_THEMES[name.trim().toLowerCase()] ?? CLASS_THEMES.fighter;
}

function buildProgressSteps(
  steps: Array<{ id: string; label: string; active: boolean; status: string }>,
): Array<{ id: string; label: string; icon: string; active: boolean; status: string }> {
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const activeIndex = CLASS_PROGRESS_STEPS.findIndex(({ id }) => stepMap.get(id)?.active);

  return CLASS_PROGRESS_STEPS.map((definition, index) => {
    const step = stepMap.get(definition.id);
    if (step) {
      return {
        ...step,
        label: definition.label,
        icon: definition.icon,
      };
    }

    const status = activeIndex >= 0 && index < activeIndex ? "complete" : "pending";
    return {
      id: definition.id,
      label: definition.label,
      icon: definition.icon,
      active: false,
      status,
    };
  });
}
