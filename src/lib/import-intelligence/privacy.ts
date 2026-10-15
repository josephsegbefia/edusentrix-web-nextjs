import type { ImportDomain, ImportLeoTask, ImportRowReference } from "./types";

export const IMPORT_AI_MAX_CONTEXT_CHARS = 24_000;
export const IMPORT_AI_MAX_UNIQUE_VALUES = 200;
export const IMPORT_AI_MAX_CATALOG_ITEMS = 500;

export function anonymizedRowRef(domain: ImportDomain, rowNumber: number): ImportRowReference {
  return `${domain === "teacher" ? "T" : "S"}${String(Math.max(0, rowNumber)).padStart(3, "0")}`;
}

export function groupVocabulary(
  values: Array<{ value: string | null | undefined; rowRef: ImportRowReference }>,
  maxGroups = IMPORT_AI_MAX_UNIQUE_VALUES
) {
  const grouped = new Map<string, Set<ImportRowReference>>();
  for (const item of values) {
    const value = item.value?.trim();
    if (!value) continue;
    const rows = grouped.get(value) ?? new Set<ImportRowReference>();
    rows.add(item.rowRef);
    grouped.set(value, rows);
  }
  return [...grouped.entries()].slice(0, maxGroups).map(([value, rows]) => ({
    value: value.slice(0, 300),
    affectedRowRefs: [...rows].slice(0, 200),
  }));
}

export function buildTeacherImportAiContext(input: {
  task: ImportLeoTask;
  headers?: string[];
  unresolvedSubjects?: Array<{ value: string; rowRef: ImportRowReference }>;
  unresolvedClasses?: Array<{ value: string; rowRef: ImportRowReference }>;
  subjectCatalog?: Array<{ catalogKey: string; label: string; gradeBand?: string; stage?: string }>;
  gradeCatalog?: Array<{ catalogKey: string; label: string }>;
  classCatalog?: Array<{ catalogKey: string; label: string; gradeKey?: string }>;
}) {
  return boundContext({
    domain: "teacher",
    task: input.task,
    headers: input.headers?.slice(0, 100),
    vocabularies: {
      unresolvedSubjects: groupVocabulary(input.unresolvedSubjects ?? []),
      unresolvedClasses: groupVocabulary(input.unresolvedClasses ?? []),
    },
    catalogs: {
      subjects: input.subjectCatalog?.slice(0, IMPORT_AI_MAX_CATALOG_ITEMS),
      grades: input.gradeCatalog?.slice(0, IMPORT_AI_MAX_CATALOG_ITEMS),
      classes: input.classCatalog?.slice(0, IMPORT_AI_MAX_CATALOG_ITEMS),
    },
    exclusions: ["teacher names", "email", "phone", "staff identifiers", "raw rows"],
  });
}

export function buildStudentImportAiContext(input: {
  task: ImportLeoTask;
  headers?: string[];
  unresolvedGrades?: Array<{ value: string; rowRef: ImportRowReference }>;
  unresolvedClasses?: Array<{ value: string; rowRef: ImportRowReference }>;
  sexValues?: string[];
  statusValues?: string[];
  gradeCatalog?: Array<{ catalogKey: string; label: string }>;
  classCatalog?: Array<{ catalogKey: string; label: string; gradeKey?: string }>;
}) {
  return boundContext({
    domain: "student",
    task: input.task,
    headers: input.headers?.slice(0, 100),
    vocabularies: {
      unresolvedGrades: groupVocabulary(input.unresolvedGrades ?? []),
      unresolvedClasses: groupVocabulary(input.unresolvedClasses ?? []),
      sexValues: [...new Set(input.sexValues ?? [])].slice(0, 50),
      statusValues: [...new Set(input.statusValues ?? [])].slice(0, 50),
    },
    catalogs: {
      grades: input.gradeCatalog?.slice(0, IMPORT_AI_MAX_CATALOG_ITEMS),
      classes: input.classCatalog?.slice(0, IMPORT_AI_MAX_CATALOG_ITEMS),
    },
    exclusions: [
      "student names",
      "date of birth",
      "admission numbers",
      "guardian information",
      "email",
      "phone",
      "GES identifiers",
      "raw rows",
    ],
  });
}

export function boundContext(value: unknown, maxChars = IMPORT_AI_MAX_CONTEXT_CHARS): string {
  const serialized = JSON.stringify(value);
  if (serialized.length <= maxChars) return serialized;
  return JSON.stringify({
    contextTruncated: true,
    maxChars,
    note: "The context was bounded by the server. Use only the supplied grouped vocabulary and catalogs.",
  });
}

export function containsSensitiveImportField(value: unknown): boolean {
  const serialized = JSON.stringify(value).toLowerCase();
  return [
    "guardian",
    "admissionno",
    "admission number",
    "dateofbirth",
    "date of birth",
    "email",
    "phone",
    "gesindex",
    "gesschool",
  ].some((field) => serialized.includes(field));
}
