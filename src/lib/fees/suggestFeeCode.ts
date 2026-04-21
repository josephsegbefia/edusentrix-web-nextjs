/**
 * Derive a stable, readable fee structure code from a display name.
 * Uppercase, A–Z / 0–9 / underscores only; max length 20 per schema.
 */
export function suggestFeeCodeFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  const deaccent = trimmed
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");

  const words = deaccent
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "FEE";

  const joined = words.join("_");
  if (joined.length <= 20) return joined;

  // Greedy fit: add as many segments as possible within the budget (readable truncation).
  const segments: string[] = [];
  let budget = 20;
  for (const w of words) {
    const sep = segments.length ? 1 : 0;
    if (sep > budget) break;
    budget -= sep;
    if (budget <= 0) break;
    const take = Math.min(w.length, budget);
    segments.push(w.slice(0, take));
    budget -= take;
    if (budget <= 0) break;
  }

  const code = segments.join("_");
  if (code.length >= 1 && code.length <= 20) return code;

  // Very long single token: hard slice
  if (words.length === 1) return words[0].slice(0, 20);

  // Fallback: initials (deterministic, short)
  const initials = words.map((w) => w[0]).join("");
  if (initials.length <= 20 && initials.length >= 2) return initials;

  return initials.slice(0, 20) || "FEE";
}
