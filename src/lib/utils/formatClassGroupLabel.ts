/**
 * Build a single display label for a class group. When `name` already starts
 * with the grade (e.g. name "Primary 6 A", grade "Primary 6"), avoid
 * duplicating: "Primary 6 Primary 6 A".
 */
export function formatClassGroupLabel(
  gradeName: string | null | undefined,
  className: string
): string {
  const name = String(className ?? "").trim();
  const grade = String(gradeName ?? "").trim();
  if (!grade) return name;
  if (!name) return grade;
  const g = grade.toLowerCase();
  const n = name.toLowerCase();
  if (n === g) return name;
  if (n.startsWith(`${g} `)) return name;
  // Name already begins with grade but no space (e.g. "Primary6 A" — uncommon)
  if (n.startsWith(g) && n.length > g.length) return name;
  return `${grade} ${name}`.trim();
}
