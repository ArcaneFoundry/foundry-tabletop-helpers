import { useEffect, useState } from "react";

import { ABILITY_LABELS, SKILLS } from "../../../../data/dnd5e-constants";
import type { CreatorIndexEntry } from "../../../../character-creator-types";
import { compendiumIndexer } from "../../../../data/compendium-indexer";
import { buildBackgroundSelectionFromEntry } from "../../../../steps/step-background";
import { cn } from "../../../../../ui/lib/cn";
import type { OriginPaneProps, OriginGalleryMetaItem } from "../components/origin-pane-primitives";
import {
  OriginDetailModal,
  OriginGalleryCard,
  SelectionPane,
} from "../components/origin-pane-primitives";

type BackgroundEntry = CreatorIndexEntry & {
  selected?: boolean;
  blurb?: string;
};

type BackgroundDetailEntry = BackgroundEntry & {
  description?: string;
};

type BackgroundStepViewModel = {
  entries: BackgroundEntry[];
  selectedEntry?: BackgroundDetailEntry | null;
  emptyMessage?: string;
};

type BackgroundSelectionPaneProps = OriginPaneProps & {
  prefersReducedMotion: boolean;
};

const BACKGROUND_ICON_BLEED_ALLOWLIST = new Set<string>([]);

export function getBackgroundArtTreatment(imageSrc: string | null | undefined): "cover" | "icon-bleed" {
  if (!imageSrc) return "cover";
  const normalizedPath = imageSrc.toLowerCase();
  if (!normalizedPath.includes("/assets/icons/backgrounds/")) return "cover";
  return BACKGROUND_ICON_BLEED_ALLOWLIST.has(normalizedPath) ? "icon-bleed" : "cover";
}

function formatSkillList(skillIds: string[]): string {
  const labels = skillIds.map((skill) => SKILLS[skill]?.label ?? skill).filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "No listed skills";
}

function formatAbilitySummary(abilities: string[]): string {
  if (abilities.length === 0) return "Flexible";
  return abilities.map((ability) => ABILITY_LABELS[ability as keyof typeof ABILITY_LABELS] ?? ability).join(", ");
}

export function BackgroundSelectionPane({ shellContext, state, controller, prefersReducedMotion }: BackgroundSelectionPaneProps) {
  const viewModel = shellContext.stepViewModel as BackgroundStepViewModel | undefined;
  const entries = viewModel?.entries ?? [];
  const selectedUuid = state.selections.background?.uuid ?? null;
  const [detailEntry, setDetailEntry] = useState<BackgroundDetailEntry | null>(null);

  useEffect(() => {
    if (!detailEntry) return;

    let cancelled = false;
    void compendiumIndexer.getCachedDescription(detailEntry.uuid).then((description) => {
      if (cancelled) return;
      setDetailEntry((current) => {
        if (!current || current.uuid !== detailEntry.uuid) return current;
        return {
          ...current,
          description: description ?? "",
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [detailEntry?.uuid]);

  return (
    <>
      <SelectionPane
        description="Choose the life your character led before the road called them onward."
        emptyState={
          <div className="rounded-[1.1rem] border border-dashed border-[#e9c176]/30 bg-[rgba(19,17,23,0.72)] px-4 py-5 font-fth-cc-body text-[#d1c4c6]">
            {viewModel?.emptyMessage ?? "No backgrounds available."}
          </div>
        }
        entries={entries}
        eyebrow="Origins"
        getEntryKey={(entry) => entry.uuid}
        introMode="hidden"
        prefersReducedMotion={prefersReducedMotion}
        renderEntry={(entry) => {
          const selected = selectedUuid === entry.uuid;
          const artTreatment = getBackgroundArtTreatment(entry.img);
          const selectedMeta: OriginGalleryMetaItem[] = selected && state.selections.background?.grants
            ? [
              {
                iconClass: "fa-solid fa-chart-simple",
                label: "Ability Scores",
                value: formatAbilitySummary(state.selections.background.grants.asiSuggested),
              },
              {
                iconClass: "fa-solid fa-stars",
                label: "Feat",
                value: state.selections.background.grants.originFeatName ?? "No feat listed",
              },
              {
                iconClass: "fa-solid fa-list-check",
                label: "Skills",
                value: formatSkillList(state.selections.background.grants.skillProficiencies),
              },
            ]
            : [];

          return (
            <OriginGalleryCard
              blurb={entry.blurb}
              cornerAction={{
                iconClass: "fa-solid fa-scroll",
                label: `Inspect background details for ${entry.name}`,
                onClick: () => setDetailEntry(entry),
              }}
              eyebrow="Background"
              fallbackIcon="fa-solid fa-scroll"
              media={entry.img ? (
                <>
                  {artTreatment === "icon-bleed" ? (
                    <img
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full scale-[1.45] object-cover opacity-70 blur-xl saturate-[0.92]"
                      loading="lazy"
                      src={entry.img}
                    />
                  ) : null}
                  <img
                    alt={entry.name}
                    className={cn(
                      "relative h-full w-full min-h-[20rem] object-cover transition duration-300",
                      artTreatment === "icon-bleed"
                        ? "scale-[1.14] group-hover:scale-[1.18]"
                        : "group-hover:scale-[1.03]",
                    )}
                    data-background-art-treatment={artTreatment}
                    loading="lazy"
                    src={entry.img}
                  />
                </>
              ) : undefined}
              meta={selectedMeta}
              onSelect={() => {
                void (async () => {
                  const selection = await buildBackgroundSelectionFromEntry(entry);
                  if (!selection) return;
                  state.selections.originFeat = undefined;
                  controller.updateCurrentStepData(selection);
                })();
              }}
              prefersReducedMotion={prefersReducedMotion}
              selected={selected}
              title={entry.name}
            />
          );
        }}
        selectionLabel="Select a Background"
        title="Background"
      />
      <OriginDetailModal
        entry={detailEntry}
        fallbackIcon="fa-solid fa-scroll"
        onClose={() => setDetailEntry(null)}
        title={detailEntry ? `${detailEntry.name} Background` : "Background Detail"}
      />
    </>
  );
}
