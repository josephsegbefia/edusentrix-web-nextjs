/** Ghana / NaCCA-aligned subject names per tier (spec §13.3). */

export const GRADE_NAMES = [
  "Creche",
  "Nursery",
  "KG1",
  "KG2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "Basic 6",
  "JHS 1",
  "JHS 2",
  "JHS 3",
] as const;

export type GradeTier = "early_years" | "kg" | "primary" | "jhs";

export function tierForGradeName(gradeName: string): GradeTier {
  if (gradeName === "Creche" || gradeName === "Nursery") return "early_years";
  if (gradeName === "KG1" || gradeName === "KG2") return "kg";
  if (gradeName.startsWith("Basic")) return "primary";
  return "jhs";
}

const EARLY_YEARS_SUBJECTS = [
  "Communication & Language",
  "Personal, Social & Emotional Development",
  "Physical Development",
  "Creative Play",
  "Music & Movement",
  "Story Time",
  "Health & Hygiene Routines",
  "Outdoor Play",
];

const KG_SUBJECTS = [
  "Language & Literacy",
  "Numeracy",
  "Creative Arts",
  "Music & Movement",
  "Our World and Our People",
  "Religious & Moral Education",
  "Physical Education",
  "Ghanaian Language",
  "Computing Readiness",
  "Story Time",
];

const PRIMARY_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Science",
  "Our World and Our People",
  "Creative Arts",
  "Religious and Moral Education",
  "Computing",
  "Ghanaian Language",
  "Physical Education",
  "History",
];

const JHS_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Integrated Science",
  "Social Studies",
  "Computing",
  "Religious and Moral Education",
  "Creative Arts and Design",
  "Career Technology",
  "Ghanaian Language",
  "French",
  "Physical Education",
];

export function subjectNamesForTier(tier: GradeTier): string[] {
  switch (tier) {
    case "early_years":
      return EARLY_YEARS_SUBJECTS;
    case "kg":
      return KG_SUBJECTS;
    case "primary":
      return PRIMARY_SUBJECTS;
    case "jhs":
      return JHS_SUBJECTS;
    default:
      return PRIMARY_SUBJECTS;
  }
}

/** Distinct union of all subject names used across tiers (for school-wide Subject documents). */
export function allDistinctSubjectNames(): string[] {
  const set = new Set<string>([
    ...EARLY_YEARS_SUBJECTS,
    ...KG_SUBJECTS,
    ...PRIMARY_SUBJECTS,
    ...JHS_SUBJECTS,
  ]);
  return Array.from(set);
}
