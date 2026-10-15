import mongoose from "mongoose";
import { deriveGradeBand } from "@/lib/subject-offerings/grade-bands";
import type {
  ITeacherImportProposedAssignment,
  ITeacherImportProvenance,
  TeacherImportMappingSource,
  TeacherImportResolutionStatus,
} from "@/models/TeacherImportJob";

export type TeacherUnderstandingGrade = {
  _id: unknown;
  name: string;
  code?: string | null;
  stage?: string | null;
  order?: number | null;
};

export type TeacherUnderstandingClass = {
  _id: unknown;
  name: string;
  gradeId: unknown;
  homeroomTeacherId?: unknown | null;
  subjectOfferingIds?: unknown[];
};

export type TeacherUnderstandingOffering = {
  _id: unknown;
  subjectId: unknown;
  displayName: string;
  shortName?: string | null;
  code?: string | null;
  subjectFamily?: string | null;
  gradeIds?: unknown[];
  gradeBand?: string | null;
  stage?: string | null;
  isActive?: boolean;
};

export type TeacherContext = {
  gradeId?: string | null;
  gradeName?: string | null;
  gradeBand?: string | null;
  classGroupId?: string | null;
  classLabel?: string | null;
  source: "homeroom" | "grade_scope" | "class_scope" | "assignment";
};

export type TeacherSubjectResolution = {
  status: TeacherImportResolutionStatus;
  source: TeacherImportMappingSource;
  candidates: TeacherUnderstandingOffering[];
  contextGradeIds: string[];
  resolutionClass: "AUTO" | "REVIEW" | "BLOCKING";
  requiresHumanConfirmation: boolean;
  note: string;
  stageMismatch?: boolean;
};

export type TeacherClassResolution = {
  status: TeacherImportResolutionStatus;
  source: TeacherImportMappingSource;
  candidates: TeacherUnderstandingClass[];
  gradeIds: string[];
  note: string;
};

export function normalizeTeacherUnderstanding(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

export function splitTeacherImportValues(value: string | null | undefined) {
  return String(value ?? "")
    .split(/[;|\n]+|\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function splitTeacherName(value: string | null | undefined) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleNames: [] as string[], lastName: "", confidence: 0 };
  if (parts.length === 1) return { firstName: parts[0], middleNames: [] as string[], lastName: "", confidence: 0.25 };
  return {
    firstName: parts[0],
    middleNames: parts.slice(1, -1),
    lastName: parts[parts.length - 1],
    confidence: parts.length === 2 ? 0.75 : 0.95,
  };
}

function id(value: unknown) {
  return String(value ?? "");
}

function numberWord(value: string) {
  const words: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
    seven: "7", eight: "8", nine: "9",
  };
  return words[value] || value;
}

function gradeNumber(value: string) {
  const normalized = normalizeTeacherUnderstanding(value);
  const match = normalized.match(/(?:primary|basic|grade|p|b|jhs|shs|juniorhighschool|seniorhighschool)(one|two|three|four|five|six|[1-9])/);
  return match ? numberWord(match[1]) : null;
}

export function gradeAliases(grade: TeacherUnderstandingGrade) {
  const raw = [grade.name, grade.code, grade.stage].filter(Boolean).map(String);
  const aliases = new Set(raw.map(normalizeTeacherUnderstanding).filter(Boolean));
  const numeric = gradeNumber(grade.code || grade.name || grade.stage || "");
  const band = deriveGradeBand(grade);
  if (numeric) {
    if (band === "lower_primary" || band === "upper_primary") {
      aliases.add(`p${numeric}`);
      aliases.add(`b${numeric}`);
      aliases.add(`basic${numeric}`);
      aliases.add(`primary${numeric}`);
      aliases.add(`grade${numeric}`);
    } else if (band === "jhs") {
      aliases.add(`jhs${numeric}`);
    } else if (band === "shs") {
      aliases.add(`shs${numeric}`);
    }
  }
  return [...aliases];
}

export function gradeBandForGrade(grade: TeacherUnderstandingGrade) {
  return deriveGradeBand(grade);
}

export function classAliases(classGroup: TeacherUnderstandingClass, grade?: TeacherUnderstandingGrade | null) {
  const aliases = new Set<string>();
  const className = String(classGroup.name || "").trim();
  const gradeValues = grade ? gradeAliases(grade) : ["" ];
  for (const classValue of [className, className.replace(/\s+/g, "")]) {
    if (!classValue) continue;
    aliases.add(normalizeTeacherUnderstanding(classValue));
    for (const gradeValue of gradeValues) {
      if (gradeValue) aliases.add(normalizeTeacherUnderstanding(`${gradeValue} ${classValue}`));
    }
    const compact = classValue.match(/^(.+?)([A-Za-z])$/);
    if (compact) aliases.add(normalizeTeacherUnderstanding(`${compact[1]} ${compact[2]}`));
  }
  return [...aliases].filter(Boolean);
}

export function resolveGradeLabel(value: string | null | undefined, grades: TeacherUnderstandingGrade[]) {
  const key = normalizeTeacherUnderstanding(value);
  if (!key) return [];
  return grades.filter((grade) => gradeAliases(grade).includes(key));
}

export function resolveClassLabel(
  value: string | null | undefined,
  grades: TeacherUnderstandingGrade[],
  classes: TeacherUnderstandingClass[]
): TeacherClassResolution {
  const key = normalizeTeacherUnderstanding(value);
  if (!key) return { status: "blocked", source: "inferred", candidates: [], gradeIds: [], note: "No class value was supplied." };
  const gradeById = new Map(grades.map((grade) => [id(grade._id), grade]));
  const candidates = classes.filter((classGroup) => classAliases(classGroup, gradeById.get(id(classGroup.gradeId))).includes(key));
  const gradeIds = [...new Set(candidates.map((item) => id(item.gradeId)))];
  if (candidates.length === 1) return { status: "resolved", source: "alias", candidates, gradeIds, note: "Matched one active school class group." };
  if (candidates.length > 1) return { status: "needs_review", source: "inferred", candidates, gradeIds, note: "More than one active school class group matches this value." };
  return { status: "needs_review", source: "inferred", candidates: [], gradeIds: [], note: "No active school class group matches this value." };
}

function subjectFamilyAliases(value: string) {
  const normalized = normalizeTeacherUnderstanding(value);
  const stripped = normalized.replace(/(?:lower|upper)?primary$|jhs$|shs$|preschool$/, "");
  const aliases = new Set([normalized, stripped]);
  const synonyms: Record<string, string[]> = {
    maths: ["mathematics"],
    math: ["mathematics"],
    ict: ["computing", "informationcommunicationtechnology"],
    pe: ["physicaleducationandhealth", "physicaleducation"],
    "ourworldandourpeople": ["socialstudies"],
  };
  for (const item of [...aliases]) for (const replacement of synonyms[item] || []) aliases.add(replacement);
  return [...aliases].filter(Boolean);
}

export function offeringAliases(offering: TeacherUnderstandingOffering) {
  return [...new Set([
    offering.displayName,
    offering.shortName,
    offering.code,
    offering.subjectFamily,
  ].filter(Boolean).flatMap((value) => subjectFamilyAliases(String(value))))];
}

function explicitStage(value: string) {
  const normalized = normalizeTeacherUnderstanding(value);
  if (/(^|-)jhs|juniorhigh/.test(normalized)) return "jhs";
  if (/(^|-)shs|seniorhigh/.test(normalized)) return "shs";
  if (/lowerprimary|upperprimary|primary/.test(normalized)) return "primary";
  return null;
}

function offeringMatchesGrade(offering: TeacherUnderstandingOffering, context: TeacherContext) {
  if (context.gradeId && (offering.gradeIds || []).some((gradeId) => id(gradeId) === context.gradeId)) return true;
  return Boolean(context.gradeBand && offering.gradeBand === context.gradeBand);
}

function offeringMatchesExplicitStage(offering: TeacherUnderstandingOffering, stage: string | null) {
  if (!stage) return true;
  if (stage === "jhs") return offering.gradeBand === "jhs" || offering.stage === "jhs";
  if (stage === "shs") return offering.gradeBand === "shs" || offering.stage === "shs";
  if (stage === "primary") return offering.gradeBand === "lower_primary" || offering.gradeBand === "upper_primary" || offering.stage === "lower_primary" || offering.stage === "upper_primary";
  return true;
}

function restrictToClassOfferings(offerings: TeacherUnderstandingOffering[], classGroup?: TeacherUnderstandingClass | null) {
  const ids = classGroup?.subjectOfferingIds || [];
  if (!ids.length) return offerings;
  const allowed = new Set(ids.map(id));
  return offerings.filter((offering) => allowed.has(id(offering._id)));
}

export function resolveSubjectForContext(input: {
  sourceValue: string;
  context?: TeacherContext | null;
  classGroup?: TeacherUnderstandingClass | null;
  offerings: TeacherUnderstandingOffering[];
}) : TeacherSubjectResolution {
  const sourceValue = input.sourceValue.trim();
  const aliases = new Set(subjectFamilyAliases(sourceValue));
  const activeOfferings = input.offerings.filter((offering) => offering.isActive !== false);
  const explicit = explicitStage(sourceValue);
  const semanticCandidates = activeOfferings.filter((offering) => offeringAliases(offering).some((alias) => aliases.has(alias)) && offeringMatchesExplicitStage(offering, explicit));
  const restricted = restrictToClassOfferings(semanticCandidates, input.classGroup);
  // A class-group curriculum assignment is useful evidence for AUTO, but it
  // must not hide a real school offering when diagnosing a stage mismatch.
  const direct = restricted.length || !input.classGroup?.subjectOfferingIds?.length ? restricted : semanticCandidates;
  const context = input.context || null;
  const compatible = context
    ? direct.filter((offering) => offeringMatchesGrade(offering, context))
    : direct;
  if (compatible.length === 1) {
    return { status: "resolved", source: "alias", candidates: compatible, contextGradeIds: context?.gradeId ? [context.gradeId] : [], resolutionClass: "AUTO", requiresHumanConfirmation: false, note: "Matched one active school subject offering using the teaching context." };
  }
  if (compatible.length > 1) {
    return { status: "needs_review", source: "inferred", candidates: compatible, contextGradeIds: context?.gradeId ? [context.gradeId] : [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, note: "Several active subject offerings remain compatible with this teaching context." };
  }
  if (direct.length && context) {
    return { status: "needs_review", source: "inferred", candidates: direct, contextGradeIds: [context.gradeId || ""].filter(Boolean), resolutionClass: "REVIEW", requiresHumanConfirmation: true, stageMismatch: true, note: `The source subject does not match the ${context.gradeBand || "resolved"} grade context.` };
  }
  if (direct.length === 1 && (!explicit || explicit === "primary")) {
    return { status: "resolved", source: "alias", candidates: direct, contextGradeIds: [], resolutionClass: "AUTO", requiresHumanConfirmation: false, note: "Matched one active school subject offering." };
  }
  if (direct.length > 1) {
    return { status: "needs_review", source: "inferred", candidates: direct, contextGradeIds: [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, note: "Several active subject offerings match this source value." };
  }
  // A source subject without a matching offering is an association decision,
  // not a malformed teacher identity. The administrator can select an
  // existing offering, accept a validated Leo suggestion, or ignore it.
  return { status: "needs_review", source: "inferred", candidates: [], contextGradeIds: context?.gradeId ? [context.gradeId] : [], resolutionClass: "REVIEW", requiresHumanConfirmation: true, note: "No active school subject offering matches this source value. Choose an offering or explicitly ignore this source subject." };
}

export function parseTeacherAssignmentText(value: string): Array<{ sourceValue: string; subjectValue: string; classValue: string; gradeValue?: string }> {
  return splitTeacherImportValues(value).map((sourceValue) => {
    const arrow = sourceValue.match(/^(.+?)\s*(?:->|→|:)\s*(.+)$/);
    const dash = sourceValue.match(/^(.+?)\s+-\s+(.+)$/);
    const compact = sourceValue.match(/^((?:p|primary|basic|grade|jhs|shs)\s*\w+\s*[a-z0-9]*)\s+(.+)$/i);
    const match = arrow || dash || compact;
    if (!match) return { sourceValue, subjectValue: sourceValue, classValue: "" };
    const left = match[1].trim();
    const right = match[2].trim();
    return { sourceValue, subjectValue: right, classValue: left };
  });
}

export function assignmentFromResolution(input: {
  parsed: { sourceValue: string; subjectValue: string; classValue: string; gradeValue?: string };
  classResolution: TeacherClassResolution;
  subjectResolution: TeacherSubjectResolution;
  provenance?: ITeacherImportProvenance[];
}): ITeacherImportProposedAssignment {
  const classGroup = input.classResolution.candidates.length === 1 ? input.classResolution.candidates[0] : null;
  const offering = input.subjectResolution.candidates.length === 1 ? input.subjectResolution.candidates[0] : null;
  const status: TeacherImportResolutionStatus = input.classResolution.status === "resolved" && input.subjectResolution.status === "resolved" ? "resolved" : input.classResolution.status === "blocked" || input.subjectResolution.status === "blocked" ? "blocked" : "needs_review";
  return {
    sourceValue: input.parsed.sourceValue,
    subjectValue: input.parsed.subjectValue,
    gradeValue: input.parsed.gradeValue || null,
    classValue: input.parsed.classValue || null,
    subjectOfferingId: offering ? id(offering._id) : null,
    gradeId: classGroup ? id(classGroup.gradeId) : null,
    classGroupId: classGroup ? id(classGroup._id) : null,
    candidateSubjectOfferingIds: input.subjectResolution.candidates.map((item) => id(item._id)),
    candidateClassGroupIds: input.classResolution.candidates.map((item) => id(item._id)),
    source: input.subjectResolution.source === "alias" && input.classResolution.source === "alias" ? "alias" : "inferred",
    status,
    issueCode: input.subjectResolution.stageMismatch ? "stage_mismatch" : status === "blocked" ? "assignment_not_resolved" : null,
    note: status === "resolved" ? "Resolved against active school class and subject offering." : `${input.classResolution.note} ${input.subjectResolution.note}`,
    provenance: input.provenance || [],
  };
}

export function provenance(input: {
  field: string;
  sourceHeader?: string | null;
  sourceValue?: string | null;
  source: TeacherImportMappingSource;
  note?: string | null;
}): ITeacherImportProvenance {
  return input;
}

export function isObjectId(value: string | null | undefined) {
  return Boolean(value && mongoose.isValidObjectId(value));
}
