import { z } from "zod";
import mongoose from "mongoose";
import type {
  RunLeoImportIntelligenceInput,
  RunLeoImportIntelligenceResult,
} from "@/lib/import-intelligence/leo";
import type { ImportLeoMetadata } from "@/lib/import-intelligence/types";
import {
  TEACHER_IMPORT_CANONICAL_FIELDS,
  type TeacherImportCanonicalField,
} from "@/lib/teachers/parse-teacher-import";

async function runImportLeo<T>(input: RunLeoImportIntelligenceInput<T>): Promise<RunLeoImportIntelligenceResult<T>> {
  const { runLeoImportIntelligence } = await import("@/lib/import-intelligence/leo");
  return runLeoImportIntelligence(input);
}

const LeoTeacherImportSchema = z.object({
  subjectSuggestions: z.array(z.object({
    sourceValue: z.string().trim().min(1).max(300),
    suggestedSubjectFamily: z.string().trim().min(1).max(200).nullable(),
    rationale: z.string().trim().max(500),
  })).max(200),
  classSuggestions: z.array(z.object({
    sourceValue: z.string().trim().min(1).max(300),
    suggestedGradeName: z.string().trim().max(200).nullable(),
    suggestedClassName: z.string().trim().max(200).nullable(),
    rationale: z.string().trim().max(500),
  })).max(200),
  stageMismatchSuggestions: z.array(z.object({
    sourceValue: z.string().trim().min(1).max(300),
    rowRefs: z.array(z.string().regex(/^T\d{3,}$/)).max(200),
    rationale: z.string().trim().max(500),
  })).max(200).optional().default([]),
  semanticSubstitutionSuggestions: z.array(z.object({
    sourceValue: z.string().trim().min(1).max(300),
    candidateSubjectFamily: z.string().trim().min(1).max(200),
    rationale: z.string().trim().max(500),
  })).max(100).optional().default([]),
});

export type TeacherImportLeoSuggestion = z.infer<typeof LeoTeacherImportSchema>;

const LeoTeacherHeaderSchema = z.object({
  headerSuggestions: z.array(z.object({
    sourceHeader: z.string().trim().min(1).max(200),
    canonicalField: z.enum(TEACHER_IMPORT_CANONICAL_FIELDS).nullable(),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().max(300),
  })).max(100),
});

export type TeacherImportHeaderSuggestion = {
  sourceHeader: string;
  canonicalField: TeacherImportCanonicalField | null;
  confidence: number;
  rationale: string;
};

export type TeacherImportLeoResult =
  | { ok: true; suggestions: TeacherImportLeoSuggestion; metadata?: ImportLeoMetadata }
  | { ok: false; unavailable: true; reason: string; metadata?: ImportLeoMetadata };

export async function suggestTeacherImportSemantics(input: {
  schoolId: mongoose.Types.ObjectId;
  unresolvedSubjects: string[];
  unresolvedClasses: string[];
  subjectCatalog: Array<{ subjectFamily: string; displayName: string; shortName: string; gradeBand: string; stage: string }>;
  gradeCatalog: string[];
  classCatalog: Array<{ gradeName: string; className: string }>;
  subjectValues?: string[];
  gradeValues?: string[];
  classValues?: string[];
  issueTypes?: string[];
}): Promise<TeacherImportLeoResult> {
  const result = await runImportLeo({
    domain: "teacher",
    task: "analyse_import",
    schoolId: input.schoolId,
    authorized: true,
    context: JSON.stringify({
      instruction: "Interpret ambiguous teacher-import vocabulary. Return only the requested JSON shape.",
      subjectCatalog: input.subjectCatalog.slice(0, 500),
      gradeCatalog: input.gradeCatalog.slice(0, 200),
      classCatalog: input.classCatalog.slice(0, 500),
      unresolvedSubjects: input.unresolvedSubjects.slice(0, 200),
      unresolvedClasses: input.unresolvedClasses.slice(0, 200),
      subjectValues: (input.subjectValues || []).slice(0, 200),
      gradeValues: (input.gradeValues || []).slice(0, 200),
      classValues: (input.classValues || []).slice(0, 200),
      issueTypes: (input.issueTypes || []).slice(0, 100),
      exclusions: ["teacher names", "email", "phone", "employee IDs", "database ids", "raw rows", "contact values"],
    }),
    responseSchema: LeoTeacherImportSchema,
    inputCount: input.unresolvedSubjects.length + input.unresolvedClasses.length,
  });
  return result.ok
    ? { ok: true, suggestions: result.data, metadata: result.metadata }
    : { ok: false, unavailable: true, reason: result.metadata.reason || "Leo assistance was unavailable.", metadata: result.metadata };
}

/** Column mapping receives only source header labels and canonical field names. */
export async function suggestTeacherImportHeaders(input: {
  schoolId: mongoose.Types.ObjectId;
  unresolvedHeaders: string[];
  headerSignals?: Array<{ sourceHeader: string; nonEmptyCount: number; valueKinds: string[] }>;
}): Promise<
  | { ok: true; suggestions: TeacherImportHeaderSuggestion[]; metadata?: ImportLeoMetadata }
  | { ok: false; unavailable: true; reason: string; metadata?: ImportLeoMetadata }
> {
  if (!input.unresolvedHeaders.length) return { ok: true, suggestions: [] };
  const result = await runImportLeo({
    domain: "teacher",
    task: "map_columns",
    schoolId: input.schoolId,
    authorized: true,
    context: JSON.stringify({
      instruction: "Map every source spreadsheet header to the single best canonical field. Use null when the meaning is ambiguous or unsupported. Never invent a field, map two non-repeatable source columns to the same canonical field, or use row values because row data is not provided.",
      sourceHeaders: input.unresolvedHeaders.slice(0, 100),
      headerSignals: (input.headerSignals || []).slice(0, 100),
      canonicalFields: TEACHER_IMPORT_CANONICAL_FIELDS,
      exclusions: ["row values", "personal data", "database ids"],
    }),
    responseSchema: LeoTeacherHeaderSchema,
    inputCount: input.unresolvedHeaders.length,
  });
  return result.ok
    ? { ok: true, suggestions: result.data.headerSuggestions, metadata: result.metadata }
    : { ok: false, unavailable: true, reason: result.metadata.reason || "Leo assistance was unavailable.", metadata: result.metadata };
}
