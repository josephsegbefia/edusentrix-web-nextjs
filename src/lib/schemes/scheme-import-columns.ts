/** Canonical NaCCA-style scheme columns for import mapping. */
export const SCHEME_IMPORT_COLUMN_LABELS = [
  "Week ending",
  "Strand",
  "Sub-strand",
  "Content standard",
  "Indicators / Learning outcomes",
  "Teaching & Learning Activities",
  "Resources",
  "Assessment",
] as const;

export type SchemeImportHeaderKey =
  | "title"
  | "week"
  | "weekEnding"
  | "strand"
  | "subStrand"
  | "contentStandard"
  | "indicators"
  | "indicatorsAndOutcomes"
  | "learningOutcomes"
  | "teachingActivities"
  | "resources"
  | "assessment"
  | "objective"
  | "notes";

export function normalizeImportHeaderCell(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[-/]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function mapSchemeImportHeaderKey(header: string): SchemeImportHeaderKey | null {
  const n = normalizeImportHeaderCell(header);
  if (!n) return null;

  // ── Week / date ──────────────────────────────────────────────────────────
  if (["title", "topic", "theme", "unit", "lesson_topic", "lesson_title"].includes(n)) return "title";
  if (["week", "wk", "week_no", "week_number", "w", "week_no_"].includes(n)) return "week";
  if (
    [
      "week_ending",
      "week_end",
      "ending",
      "week_ending_date",
      "planned_end_date",
      "date",
      "dates",
      "week_date",
    ].includes(n)
  ) {
    return "weekEnding";
  }

  // ── Strand / sub-strand (sub-strand MUST be checked before strand — "sub_strand" ends with "_strand") ──
  if (
    [
      "sub_strand",
      "substrand",
      "sub_topic",
      "subtopic",
      "sub_strand_s",
      "sub_strands",
      "sub_theme",
      "subtheme",
      "sub_strand_topic",
    ].includes(n) ||
    (n.includes("sub") && n.includes("strand"))
  ) {
    return "subStrand";
  }
  if (n === "strand" || n === "strand_s" || n === "strands") return "strand";

  // ── Content standard ─────────────────────────────────────────────────────
  if (
    [
      "content_standard",
      "standard",
      "content_standards",
      "content_standard_s",
      "curriculum_code",
      "code",
    ].includes(n) ||
    (n.includes("content") && n.includes("standard"))
  ) {
    return "contentStandard";
  }

  // ── Indicators / learning outcomes — combined column (most GES sheets) ──
  if (
    [
      "indicators_and_learning_outcomes",
      "indicators_learning_outcomes",
      "indicator_and_learning_outcomes",
      "indicators_slash_learning_outcomes",
      "indicators_and_outcomes",
      "indicators_outcomes",
      "performance_indicators_and_learning_outcomes",
      "indicators_learning_outcomes_",
    ].includes(n) ||
    (n.includes("indicator") && n.includes("outcome"))
  ) {
    return "indicatorsAndOutcomes";
  }

  // ── Learning outcomes (standalone column) ────────────────────────────────
  if (
    [
      "learning_outcomes",
      "learning_outcome",
      "outcomes",
      "lo_s",
      "los",
      "specific_objectives",
      "specific_objective",
      "objectives",
      "learner_outcomes",
      "expected_outcomes",
    ].includes(n) ||
    (n.includes("learning") && n.includes("outcome")) ||
    (n.includes("specific") && n.includes("objectiv"))
  ) {
    return "learningOutcomes";
  }

  // ── Indicators (standalone column) ───────────────────────────────────────
  if (
    [
      "indicator",
      "indicators",
      "indicator_s",
      "performance_indicators",
      "performance_indicator",
      "learning_indicators",
    ].includes(n) ||
    (n.includes("indicator") && !n.includes("outcome"))
  ) {
    return "indicators";
  }

  // ── Teaching & learning activities ───────────────────────────────────────
  if (
    [
      "teaching_and_learning_activities",
      "teaching_learning_activities",
      "teaching_and_learning",
      "teaching_learning",
      "teaching_and_learning_activities_tla",
      "learning_activities",
      "tla",
      "t_and_l_activities",
      "t_and_l",
      "t_l_activities",
      "main_activity",
      "main_activities",
      "activities",
      "teaching_activities",
      "learners_activities",
      "learner_activities",
      "learners__activities",
      "core_activities",
      "guided_activities",
      "classroom_activities",
      "lesson_activities",
      "activity",
      "teacher_and_learner_activities",
      "teacher_learner_activities",
      "teacher_activities_and_learner_activities",
      "pedagogical_approaches",
      "pedagogy",
      "teaching_methodology",
      "teaching_methodologies",
      "instructional_activities",
    ].includes(n) ||
    (n.includes("teaching") && n.includes("learning") && n.includes("activit")) ||
    (n.includes("teaching") && n.includes("activit")) ||
    (n.includes("learning") && n.includes("activit") && !n.includes("outcome") && !n.includes("indicator")) ||
    (n.includes("learner") && n.includes("activit")) ||
    (n.includes("teacher") && n.includes("activit")) ||
    (n.includes("pedagog") && n.includes("approach"))
  ) {
    return "teachingActivities";
  }

  // ── Resources ────────────────────────────────────────────────────────────
  if (
    [
      "resource",
      "resources",
      "teaching_resources",
      "materials",
      "tlms",
      "tlm",
      "teaching_learning_materials",
      "teaching_aids",
      "instructional_materials",
      "reference",
      "references",
      "ict_tools",
      "tools",
    ].includes(n) ||
    n.includes("resource") ||
    n.includes("material") ||
    n.includes("teaching_aid")
  ) {
    return "resources";
  }

  // ── Assessment ───────────────────────────────────────────────────────────
  if (
    [
      "assessment",
      "assessments",
      "evaluation",
      "evaluations",
      "assessment_tasks",
      "evaluation_tasks",
      "class_exercise",
      "classwork",
      "class_work",
      "class_work_and_homework",
      "classwork_and_homework",
      "classwork_homework",
      "homework",
      "home_work",
      "exercise",
      "exercises",
      "core_tasks",
      "core_task",
      "project_work",
      "project",
      "formative_assessment",
      "summative_assessment",
      "written_exercise",
      "oral_assessment",
    ].includes(n) ||
    n.includes("assessment") ||
    n.includes("evaluation") ||
    n.includes("classwork") ||
    n.includes("homework") ||
    n.includes("core_task") ||
    n.includes("exercise")
  ) {
    return "assessment";
  }

  // ── Objective / notes ────────────────────────────────────────────────────
  if (
    ["learning_objective", "objective", "lo", "learning_objectives"].includes(n)
  ) {
    return "objective";
  }
  if (["notes", "note", "remarks", "comments", "remark"].includes(n) || n.includes("remark")) {
    return "notes";
  }

  // ── Fuzzy catch-alls ─────────────────────────────────────────────────────
  if (n.includes("topic") || (n.includes("title") && !n.includes("subtitle"))) return "title";
  if (n.includes("week") && (n.includes("end") || n.includes("ending"))) return "weekEnding";
  if (n.includes("week")) return "week";
  return null;
}

/**
 * Splits a cell value into a list of distinct items.
 *
 * Strategy:
 * 1. Always split on newlines — the clearest separator in multi-line cells.
 * 2. Split on semicolons — common in NaCCA-style indicator lists.
 * 3. Only split on commas when every resulting segment is short (≤ 80 chars)
 *    AND the value as a whole looks like a proper list (≥ 3 segments after the
 *    split).  This prevents turning prose sentences into fragments while still
 *    handling comma-separated short item lists.
 */
export function splitImportList(value: string | null): string[] {
  if (!value) return [];

  // Step 1: split on newlines / semicolons
  const byNewlineOrSemicolon = value
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  // If newline/semicolon split already produced ≥ 2 items, stop there.
  if (byNewlineOrSemicolon.length >= 2) {
    return byNewlineOrSemicolon.slice(0, 30);
  }

  // Step 2: consider comma splitting — but only for short enumerated items.
  const rawSegments = value.split(",").map((s) => s.trim()).filter(Boolean);
  const allShort = rawSegments.every((seg) => seg.length <= 80);
  if (allShort && rawSegments.length >= 3) {
    return rawSegments.slice(0, 30);
  }

  // Step 3: treat the entire value as a single prose item.
  return [value.trim()];
}

/**
 * Like splitImportList but treats the value as a prose block — never splits
 * on commas and only splits on explicit newlines.  Use for TLA and assessment
 * columns where prose sentences are common.
 */
export function splitProseBlock(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}
