import type { IGrade } from "@/models/Grade";
import type {
  SubjectOfferingGradeBand,
  SubjectOfferingStage,
} from "@/models/SubjectOffering";

export function normalizeGradeCode(input: {
  code?: string | null;
  name?: string | null;
  stage?: string | null;
}): string {
  const raw = input.code || input.name || input.stage || "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function deriveGradeBand(input: {
  code?: string | null;
  name?: string | null;
  stage?: string | null;
  order?: number | null;
}): SubjectOfferingGradeBand {
  const value = normalizeGradeCode(input);
  if (["CRECHE", "NURSERY", "KG1", "KG2", "KINDERGARTEN1", "KINDERGARTEN2"].includes(value)) {
    return "preschool";
  }
  if (["P1", "P2", "P3", "B1", "B2", "B3", "BASIC1", "BASIC2", "BASIC3", "PRIMARY1", "PRIMARY2", "PRIMARY3", "GRADE1", "GRADE2", "GRADE3"].includes(value)) {
    return "lower_primary";
  }
  if (["P4", "P5", "P6", "B4", "B5", "B6", "BASIC4", "BASIC5", "BASIC6", "PRIMARY4", "PRIMARY5", "PRIMARY6", "GRADE4", "GRADE5", "GRADE6"].includes(value)) {
    return "upper_primary";
  }
  if (["JHS1", "JHS2", "JHS3", "JUNIORHIGHSCHOOL1", "JUNIORHIGHSCHOOL2", "JUNIORHIGHSCHOOL3"].includes(value)) {
    return "jhs";
  }
  if (["SHS1", "SHS2", "SHS3", "SENIORHIGHSCHOOL1", "SENIORHIGHSCHOOL2", "SENIORHIGHSCHOOL3"].includes(value)) {
    return "shs";
  }
  const stage = (input.stage || "").toLowerCase();
  if (stage.includes("kg") || stage.includes("nursery") || stage.includes("creche")) return "preschool";
  if (stage.includes("jhs")) return "jhs";
  if (stage.includes("shs")) return "shs";
  if (stage.includes("primary") && Number(input.order ?? 0) <= 3) return "lower_primary";
  if (stage.includes("primary")) return "upper_primary";
  return "custom";
}

export function stageFromGradeBand(gradeBand: SubjectOfferingGradeBand): SubjectOfferingStage {
  if (gradeBand === "preschool") return "kg";
  return gradeBand;
}

export function gradeMatchesTemplateCode(
  grade: Pick<IGrade, "code" | "name" | "stage" | "order">,
  templateGradeCodes: string[]
): boolean {
  const normalized = normalizeGradeCode(grade);
  const aliases = new Set([normalized, deriveGradeBand(grade).toUpperCase()]);
  const basicMatch = normalized.match(/^BASIC([1-9])$/);
  const primaryMatch = normalized.match(/^PRIMARY([1-9])$/);
  const gradeMatch = normalized.match(/^GRADE([1-9])$/);
  const pMatch = normalized.match(/^P([1-9])$/);
  const bMatch = normalized.match(/^B([1-9])$/);
  const numeric = basicMatch?.[1] ?? primaryMatch?.[1] ?? gradeMatch?.[1] ?? pMatch?.[1] ?? bMatch?.[1];
  if (numeric) {
    aliases.add(`P${numeric}`);
    aliases.add(`B${numeric}`);
    aliases.add(`BASIC${numeric}`);
    aliases.add(`PRIMARY${numeric}`);
    aliases.add(`GRADE${numeric}`);
  }
  if (normalized === "KINDERGARTEN1") aliases.add("KG1");
  if (normalized === "KINDERGARTEN2") aliases.add("KG2");
  return templateGradeCodes.some((code) => aliases.has(normalizeGradeCode({ code })));
}
