/** Matches `SchemeItem` mongoose maxlength for title/strand/subStrand/topic. */
export const SCHEME_ITEM_SHORT_TEXT_MAX = 260;

export function clampSchemeItemShortText(
  value: string | null | undefined,
  max = SCHEME_ITEM_SHORT_TEXT_MAX,
): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd();
}

export function clampSchemeItemShortTextOrNull(
  value: string | null | undefined,
  max = SCHEME_ITEM_SHORT_TEXT_MAX,
): string | null {
  const text = clampSchemeItemShortText(value, max);
  return text || null;
}
