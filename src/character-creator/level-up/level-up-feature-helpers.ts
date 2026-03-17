import { fromUuid } from "../../types";
import type { ClassItemInfo, LevelUpFeaturesChoice, AdvancementEntry } from "./level-up-types";
import { extractClassAdvancement } from "./level-up-detection-helpers";

export interface LevelUpGrantedFeature {
  uuid: string;
  name: string;
  fromAdvancement: true;
}

interface AdvancementCarrierDocumentLike {
  system?: Record<string, unknown>;
  toObject?(): {
    system?: Record<string, unknown>;
  };
}

export function getGrantedFeaturesFromAdvancement(
  advancement: AdvancementEntry[],
  matchesLevel: (level: number | undefined) => boolean,
): LevelUpGrantedFeature[] {
  const matchingFeatures = advancement.filter((entry) =>
    entry.type === "ItemGrant" && matchesLevel(entry.level),
  );

  return matchingFeatures.flatMap((entry) => {
    const items = (entry.configuration?.items as Array<{ uuid?: string; name?: string }> | undefined) ?? [];
    return items
      .filter((item): item is { uuid: string; name?: string } => typeof item.uuid === "string" && item.uuid.length > 0)
      .map((item) => ({
        uuid: item.uuid,
        name: item.name ?? "Feature",
        fromAdvancement: true as const,
      }));
  });
}

export function getGrantedFeaturesForLevel(
  classInfo: ClassItemInfo | null | undefined,
  newClassLevel: number,
): LevelUpGrantedFeature[] {
  const advancement = classInfo?.advancement ?? [];
  return getGrantedFeaturesFromAdvancement(advancement, (level) => level === newClassLevel);
}

export async function resolveGrantedFeaturesForDocument(
  uuid: string | undefined,
  options: {
    level?: number;
    maxLevel?: number;
  },
): Promise<LevelUpGrantedFeature[]> {
  if (!uuid) return [];

  const doc = await fromUuid(uuid) as AdvancementCarrierDocumentLike | null;
  const objectSystem = doc?.toObject?.().system;
  const system = objectSystem || doc?.system
    ? {
        ...(typeof objectSystem === "object" && objectSystem !== null ? objectSystem : {}),
        ...(typeof doc?.system === "object" && doc.system !== null ? doc.system : {}),
      }
    : null;
  if (!system) return [];

  const advancement = extractClassAdvancement(system);
  if (options.level !== undefined) {
    return getGrantedFeaturesFromAdvancement(advancement, (level) => level === options.level);
  }
  if (options.maxLevel !== undefined) {
    const { maxLevel } = options;
    return getGrantedFeaturesFromAdvancement(advancement, (level) => typeof level === "number" && level <= maxLevel);
  }

  return [];
}

export function buildFeatureSelectionForLevel(
  classInfo: ClassItemInfo | null | undefined,
  newClassLevel: number,
): LevelUpFeaturesChoice | undefined {
  const features = getGrantedFeaturesForLevel(classInfo, newClassLevel);
  if (features.length === 0) return undefined;

  return {
    acceptedFeatureUuids: features.map((feature) => feature.uuid),
    featureNames: features.map((feature) => feature.name),
  };
}
