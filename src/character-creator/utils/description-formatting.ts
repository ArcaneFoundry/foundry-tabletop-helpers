const BLOCK_TAG_RE = /<(?:p|ul|ol|li|div|section|article|table|blockquote|h[1-6]|pre)\b/i;
const ABILITY_SEGMENT_LABELS: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function normalizeDescriptionTokens(text: string): string {
  return text
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, "")
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
    .replace(/\[\[\/award\s+([^[\]]+)\]\]/gi, "$1")
    .replace(/\[\[lookup\s+@name\s+lowercase\]\]/gi, "you")
    .replace(/\[\[lookup\s+@name\]\]/gi, "You")
    .replace(/\[\[lookup\s+@([a-zA-Z0-9_.]+)(?:\s+[a-z]+)?\]\]/gi, (_match, path: string) => formatLookupPath(path))
    .replace(/\[\[\/item\s+([^\]]+)\]\]/gi, "$1")
    .replace(/\[\[\/[^\]]+\]\]/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/\b(\d+)(GP|SP|CP|EP|PP)\b/g, "$1 $2")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]+\)/g, ")")
    .trim();
}

function formatLookupPath(path: string): string {
  const normalized = path.toLowerCase();

  if (normalized === "prof") return "your proficiency bonus";
  if (normalized === "level") return "your level";

  const abilityMatch = normalized.match(/^abilities\.(str|dex|con|int|wis|cha)\.mod$/);
  if (abilityMatch) {
    const ability = ABILITY_SEGMENT_LABELS[abilityMatch[1] ?? ""];
    if (ability) return `your ${ability} modifier`;
  }

  const lastSegment = normalized.split(".").at(-1);
  if (lastSegment === "mod") return "your modifier";
  if (lastSegment === "dc") return "your DC";
  if (lastSegment === "value") return "your value";

  return "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapPlainTextInParagraphs(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function formatLeadingFactLabels(html: string): string {
  return html.replace(
    /(<p\b[^>]*>\s*)([A-Z][A-Za-z][A-Za-z /'-]*:)(\s*)/g,
    "$1<strong class=\"cc-card-detail__fact-label\">$2</strong>$3",
  );
}

function formatEquipmentChoicesInHtml(html: string): string {
  return html
    .replace(
      /(Choose\s+[A-Z](?:\s*,\s*[A-Z])*(?:\s*,?\s*or\s+[A-Z])?:)/gi,
      "<strong class=\"cc-card-detail__choice-heading\">$1</strong>",
    )
    .replace(/:\s*(\([A-Z]\))/g, ":<br>$1")
    .replace(/;\s*(?:or\s+)?(\([A-Z]\))/g, "<br>$1")
    .replace(
      /(\([A-Z]\))/g,
      "<strong class=\"cc-card-detail__choice-marker\">$1</strong>",
    );
}

export function formatInjectedDescriptionHtml(html: string): string {
  if (!html) return "";

  const normalized = normalizeDescriptionTokens(html);
  const paragraphized = BLOCK_TAG_RE.test(normalized)
    ? normalized
    : wrapPlainTextInParagraphs(normalized);

  return formatEquipmentChoicesInHtml(formatLeadingFactLabels(paragraphized));
}

export const __descriptionFormattingInternals = {
  formatLookupPath,
  normalizeDescriptionTokens,
  wrapPlainTextInParagraphs,
  formatLeadingFactLabels,
  formatEquipmentChoicesInHtml,
};
