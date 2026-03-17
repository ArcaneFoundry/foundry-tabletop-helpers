export interface SpellScaleAdvancementLike {
  title?: string;
  type?: string;
  configuration?: {
    identifier?: string;
    scale?: Record<string, { value?: number }>;
  };
}

export interface SpellPreparationClassDocumentLike {
  system?: {
    advancement?: SpellScaleAdvancementLike[];
    spellcasting?: {
      preparation?: {
        formula?: string;
      };
    };
  };
}

export interface SpellPreparationPolicy {
  usesPreparedSpells: boolean;
  preparedLimit: number | null;
  usesPreparedSpellPicker: boolean;
}

export function getSpellPreparationPolicy(
  _classIdentifier: string,
  classDoc: SpellPreparationClassDocumentLike | null | undefined,
  level: number,
): SpellPreparationPolicy {
  const formula = classDoc?.system?.spellcasting?.preparation?.formula ?? "";
  const scaleIdentifier = parsePreparationScaleIdentifier(formula);
  const preparedLimit = scaleIdentifier
    ? resolveScaleByIdentifier(classDoc?.system?.advancement ?? [], scaleIdentifier, level)
    : null;

  return {
    usesPreparedSpells: preparedLimit !== null && preparedLimit > 0,
    preparedLimit,
    usesPreparedSpellPicker: preparedLimit !== null && preparedLimit > 0,
  };
}

export function buildPreparationNotice(
  className: string,
  spellCount: number,
  policy: SpellPreparationPolicy,
): string | null {
  if (!policy.usesPreparedSpells) return null;

  if (policy.usesPreparedSpellPicker) {
    const preparedCount = Math.min(spellCount, policy.preparedLimit ?? 0);
    const preparedLabel = preparedCount === 1 ? "spell" : "spells";
    return preparedCount > 0
      ? `Choose which ${preparedCount} leveled ${preparedLabel} start prepared for this ${className}. You can change them later on the sheet.`
      : `Choose which leveled spells start prepared for this ${className}. You can change them later on the sheet.`;
  }

  return null;
}

export function parsePreparationScaleIdentifier(formula: string): string | null {
  const match = formula.match(/^@scale\.[^.]+\.([a-z0-9-]+)$/i);
  return match?.[1] ?? null;
}

function resolveScaleByIdentifier(
  advancements: SpellScaleAdvancementLike[],
  identifier: string,
  level: number,
): number | null {
  const match = advancements.find((entry) =>
    entry.type === "ScaleValue" && entry.configuration?.identifier === identifier
  );
  return resolveScaleValue(match?.configuration?.scale, level);
}

export function resolveScaleValue(
  scale: Record<string, { value?: number }> | undefined,
  level: number,
): number | null {
  if (!scale) return null;

  const matchingLevels = Object.keys(scale)
    .map((key) => Number.parseInt(key, 10))
    .filter((key) => !Number.isNaN(key) && key <= level)
    .sort((a, b) => b - a);

  const matchedLevel = matchingLevels[0];
  if (matchedLevel === undefined) return null;

  const value = scale[String(matchedLevel)]?.value;
  return typeof value === "number" ? value : null;
}
