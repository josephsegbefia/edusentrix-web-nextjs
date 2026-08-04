import mongoose from "mongoose";
import { Student } from "@/models/Student";

export const SUPPORTED_STUDENT_ID_TOKENS = [
  "schoolPrefix",
  "enrollYear2",
  "enrollYear4",
  "birthMonth2",
  "birthYear2",
  "birthYear4",
  "initials",
  "firstInitial",
  "lastInitial",
  "gradeCode",
  "classCode",
  "sequence3",
  "sequence4",
  "sequence5",
] as const;

export type StudentIdPatternToken = (typeof SUPPORTED_STUDENT_ID_TOKENS)[number];

export type StudentIdRequiredField =
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "enrolledAt"
  | "gradeId"
  | "classGroupId";

export type StudentIdPatternSource = "leo" | "standard";

export type StudentIdPatternDraft = {
  template: string;
  source: StudentIdPatternSource;
  explanation?: string | null;
  requiredFields: StudentIdRequiredField[];
};

export type StudentIdPatternContext = {
  schoolId: mongoose.Types.ObjectId;
  schoolName: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | Date | null;
  enrolledAt?: string | Date | null;
  gradeName?: string | null;
  classGroupName?: string | null;
};

export type StudentIdPatternGenerationResult = {
  admissionNo: string;
  breakdown: Record<string, string>;
};

const DEFAULT_TEMPLATE = "{schoolPrefix}-{enrollYear2}{birthMonth2}-{initials}-{sequence4}";

const TOKEN_REQUIRED_FIELDS: Record<StudentIdPatternToken, StudentIdRequiredField[]> = {
  schoolPrefix: [],
  enrollYear2: [],
  enrollYear4: [],
  birthMonth2: ["dateOfBirth"],
  birthYear2: ["dateOfBirth"],
  birthYear4: ["dateOfBirth"],
  initials: ["firstName", "lastName"],
  firstInitial: ["firstName"],
  lastInitial: ["lastName"],
  gradeCode: ["gradeId"],
  classCode: ["classGroupId"],
  sequence3: [],
  sequence4: [],
  sequence5: [],
};

function toAsciiUpper(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function sanitizeStudentIdTemplate(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9{}_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}

export function sanitizeAdmissionCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildSchoolPrefix(schoolName: string): string {
  const words = schoolName
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "SCH";

  const skip = new Set([
    "the",
    "of",
    "and",
    "school",
    "academy",
    "college",
    "international",
    "preparatory",
    "prep",
    "basic",
    "primary",
    "junior",
    "senior",
    "high",
    "complex",
  ]);

  const significant = words.filter((word) => !skip.has(word.toLowerCase()));
  const source = significant.length > 0 ? significant : words;

  if (source.length === 1) {
    return toAsciiUpper(source[0].slice(0, 3)) || "SCH";
  }

  return (
    source
      .slice(0, 4)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "SCH"
  );
}

export function buildStudentIdPatternDraft(input?: Partial<StudentIdPatternDraft> | null) {
  const template = sanitizeStudentIdTemplate(input?.template || DEFAULT_TEMPLATE) || DEFAULT_TEMPLATE;
  const requiredFields =
    input?.requiredFields && input.requiredFields.length > 0
      ? Array.from(new Set(input.requiredFields))
      : extractRequiredFieldsFromTemplate(template);

  return {
    template,
    source: input?.source === "leo" ? "leo" : "standard",
    explanation: input?.explanation?.trim() || null,
    requiredFields,
  } satisfies StudentIdPatternDraft;
}

export function extractRequiredFieldsFromTemplate(template: string): StudentIdRequiredField[] {
  const required = new Set<StudentIdRequiredField>();
  const matches = template.matchAll(/\{([A-Za-z0-9_]+)\}/g);
  for (const match of matches) {
    const token = match[1] as StudentIdPatternToken;
    if (!(SUPPORTED_STUDENT_ID_TOKENS as readonly string[]).includes(token)) continue;
    for (const field of TOKEN_REQUIRED_FIELDS[token]) {
      required.add(field);
    }
  }
  return Array.from(required);
}

export function missingFieldsForPattern(
  pattern: StudentIdPatternDraft,
  ctx: Omit<StudentIdPatternContext, "schoolId" | "schoolName">
) {
  return pattern.requiredFields.filter((field) => {
    if (field === "firstName") return !ctx.firstName?.trim();
    if (field === "lastName") return !ctx.lastName?.trim();
    if (field === "dateOfBirth") return !ctx.dateOfBirth;
    if (field === "enrolledAt") return !ctx.enrolledAt;
    if (field === "gradeId") return !ctx.gradeName?.trim();
    if (field === "classGroupId") return !ctx.classGroupName?.trim();
    return false;
  });
}

function buildInitial(value?: string | null) {
  return toAsciiUpper((value || "").trim().charAt(0));
}

function buildCodeFromLabel(value?: string | null) {
  const normalized = toAsciiUpper(value || "").replace(/[^A-Z0-9]/g, "");
  return normalized.slice(0, 3);
}

function coerceDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function nextSequenceNumber(schoolId: mongoose.Types.ObjectId) {
  return (await Student.countDocuments({ schoolId })) + 1;
}

function padSequence(value: number, width: 3 | 4 | 5) {
  return String(value).padStart(width, "0");
}

function replaceSequenceTokens(template: string, sequence: number) {
  return template
    .replaceAll("{sequence3}", padSequence(sequence, 3))
    .replaceAll("{sequence4}", padSequence(sequence, 4))
    .replaceAll("{sequence5}", padSequence(sequence, 5));
}

function renderNonSequenceTokens(
  template: string,
  ctx: StudentIdPatternContext
) {
  const dateOfBirth = coerceDate(ctx.dateOfBirth);
  const enrolledAt = coerceDate(ctx.enrolledAt) ?? new Date();
  const schoolPrefix = buildSchoolPrefix(ctx.schoolName);
  const firstInitial = buildInitial(ctx.firstName);
  const lastInitial = buildInitial(ctx.lastName);
  const initials = `${firstInitial}${lastInitial}`.replace(/[^A-Z]/g, "");
  const birthMonth2 = dateOfBirth ? String(dateOfBirth.getMonth() + 1).padStart(2, "0") : "";
  const birthYear4 = dateOfBirth ? String(dateOfBirth.getFullYear()) : "";
  const birthYear2 = birthYear4 ? birthYear4.slice(-2) : "";
  const enrollYear4 = String(enrolledAt.getFullYear());
  const enrollYear2 = enrollYear4.slice(-2);
  const gradeCode = buildCodeFromLabel(ctx.gradeName);
  const classCode = buildCodeFromLabel(ctx.classGroupName);

  const tokenValues: Record<string, string> = {
    schoolPrefix,
    enrollYear2,
    enrollYear4,
    birthMonth2,
    birthYear2,
    birthYear4,
    initials,
    firstInitial,
    lastInitial,
    gradeCode,
    classCode,
  };

  let rendered = template;
  for (const [token, value] of Object.entries(tokenValues)) {
    rendered = rendered.replaceAll(`{${token}}`, value);
  }

  return {
    rendered,
    breakdown: {
      schoolPrefix,
      enrollYear2,
      enrollYear4,
      birthMonth2,
      birthYear2,
      birthYear4,
      initials,
      firstInitial,
      lastInitial,
      gradeCode,
      classCode,
    },
  };
}

export async function ensureUniqueAdmissionNo(
  schoolId: mongoose.Types.ObjectId,
  base: string
): Promise<string> {
  let candidate = base;
  let suffix = 0;
  for (;;) {
    const exists = await Student.findOne({ schoolId, admissionNo: candidate }).lean();
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function generateAdmissionNoFromPattern(
  patternInput: Partial<StudentIdPatternDraft> | null | undefined,
  ctx: StudentIdPatternContext
): Promise<StudentIdPatternGenerationResult> {
  const pattern = buildStudentIdPatternDraft(patternInput);
  const { rendered, breakdown } = renderNonSequenceTokens(pattern.template, ctx);
  const baseSequence = await nextSequenceNumber(ctx.schoolId);

  for (let sequence = baseSequence; sequence < baseSequence + 500; sequence += 1) {
    const withSequence = replaceSequenceTokens(rendered, sequence);
    const normalized = sanitizeAdmissionCandidate(withSequence);
    if (!normalized) continue;
    const unique = await Student.findOne({
      schoolId: ctx.schoolId,
      admissionNo: normalized,
    }).lean();
    if (!unique) {
      return {
        admissionNo: normalized,
        breakdown: {
          ...breakdown,
          sequence3: padSequence(sequence, 3),
          sequence4: padSequence(sequence, 4),
          sequence5: padSequence(sequence, 5),
        },
      };
    }
  }

  const fallbackBase = sanitizeAdmissionCandidate(
    replaceSequenceTokens(rendered, baseSequence)
  );
  const unique = await ensureUniqueAdmissionNo(ctx.schoolId, fallbackBase || "STUDENT");
  return {
    admissionNo: unique,
    breakdown: {
      ...breakdown,
      sequence3: padSequence(baseSequence, 3),
      sequence4: padSequence(baseSequence, 4),
      sequence5: padSequence(baseSequence, 5),
    },
  };
}

export function buildDefaultStudentIdPattern(): StudentIdPatternDraft {
  return buildStudentIdPatternDraft({
    template: DEFAULT_TEMPLATE,
    source: "standard",
    explanation:
      "School prefix + enrolment year + birth month + student initials + sequence number.",
  });
}
