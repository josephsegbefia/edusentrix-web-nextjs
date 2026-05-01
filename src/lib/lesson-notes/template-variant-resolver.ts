/**
 * Spec §5 / §31 Phase 1 — template variant hints derived from grade naming.
 * Does not change the lesson-note wizard UI; ready for resolver pipelines and NaCCA variants.
 */

export type LessonNoteLevelVariant =
  | "creche"
  | "nursery"
  | "kg1"
  | "kg2"
  | "primary"
  | "jhs"
  | "shs"
  | "other";

export type LessonNoteTemplateBucket = "early_years" | "primary_jhs" | "other";

/**
 * Infer a coarse NaCCA / early-years bucket from a human-readable grade name
 * (e.g. ClassGroup → Grade.name).
 */
export function inferLessonNoteLevelVariant(gradeName: string | null | undefined): LessonNoteLevelVariant {
  const n = (gradeName || "").toLowerCase().trim();
  if (!n) return "other";

  if (/\b(creche|crèche|daycare)\b/.test(n)) return "creche";
  if (/\b(nursery|pre-nursery|pre nursery)\b/.test(n)) return "nursery";
  if (/\bkg\s*1\b|\bkindergarten\s*1\b/.test(n)) return "kg1";
  if (/\bkg\s*2\b|\bkindergarten\s*2\b/.test(n)) return "kg2";
  if (/\bjhs\b|\bjunior\s*high\b|\bjhs\s*\d/.test(n)) return "jhs";
  if (/\bshs\b|\bsenior\s*high\b|\bshs\s*\d/.test(n)) return "shs";
  if (
    /\b(primary|basic\s*\d|p\.?\s*\d|class\s*1|class\s*2|class\s*3|class\s*4|class\s*5|class\s*6)\b/.test(
      n
    )
  ) {
    return "primary";
  }

  return "other";
}

export function templateBucketFromLevelVariant(v: LessonNoteLevelVariant): LessonNoteTemplateBucket {
  if (v === "creche" || v === "nursery" || v === "kg1" || v === "kg2") return "early_years";
  if (v === "primary" || v === "jhs") return "primary_jhs";
  return "other";
}
