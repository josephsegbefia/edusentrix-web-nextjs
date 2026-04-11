import type { CurriculumProfile } from "@/constants/curriculum-profiles";

type PeriodRow = {
  id: string;
  yearLabel: string;
  term: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Read-only snapshot for admin: curriculum profile labels + configured academic periods.
 * Does not alter lesson notes, report templates, or grading data.
 */
export function buildCambridgeCurriculumSnapshotCsv(input: {
  schoolName: string;
  schoolId: string;
  exportGeneratedAtIso: string;
  profile: CurriculumProfile;
  reportCardPresetName: string;
  periods: PeriodRow[];
}): string {
  const { profile } = input;
  const lines: string[] = [];

  lines.push("section,key,value");
  lines.push(`metadata,school_name,${escapeCsv(input.schoolName)}`);
  lines.push(`metadata,school_id,${escapeCsv(input.schoolId)}`);
  lines.push(`metadata,curriculum_code,${escapeCsv(profile.code)}`);
  lines.push(`metadata,curriculum_label,${escapeCsv(profile.label)}`);
  lines.push(`metadata,export_generated_at,${escapeCsv(input.exportGeneratedAtIso)}`);
  lines.push(`metadata,report_card_preset,${escapeCsv(input.reportCardPresetName)}`);
  lines.push(`profile,description,${escapeCsv(profile.description)}`);
  lines.push(`profile,assessment_model,${escapeCsv(profile.assessmentModel)}`);
  lines.push(`profile,term_structure,${escapeCsv(profile.termStructure)}`);
  lines.push(`profile,grading_system,${escapeCsv(profile.gradingSystem)}`);
  lines.push(`profile,pass_threshold_percent,${String(profile.passThreshold)}`);
  lines.push(`profile,default_ca_weight,${String(profile.defaultCaWeight)}`);
  lines.push(`profile,default_exam_weight,${String(profile.defaultExamWeight)}`);
  lines.push(
    `profile,default_term_labels,${escapeCsv(profile.termLabels.join(" | "))}`
  );

  lines.push("");
  lines.push("id,year_label,term,start_date,end_date,is_current");
  for (const p of input.periods) {
    lines.push(
      [
        escapeCsv(p.id),
        escapeCsv(p.yearLabel),
        escapeCsv(p.term),
        escapeCsv(p.startDate),
        escapeCsv(p.endDate),
        p.isCurrent ? "yes" : "no",
      ].join(",")
    );
  }

  return lines.join("\n");
}
