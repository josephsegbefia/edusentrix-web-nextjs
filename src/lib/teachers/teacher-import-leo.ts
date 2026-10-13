import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";
import { resolveLeoAccess } from "@/lib/leo/access";
import {
  TEACHER_IMPORT_CANONICAL_FIELDS,
  type TeacherImportCanonicalField,
} from "@/lib/teachers/parse-teacher-import";

const LeoTeacherImportSchema = z.object({
  subjectSuggestions: z.array(
    z.object({
      sourceValue: z.string().trim().min(1).max(300),
      suggestedSubjectFamily: z.string().trim().min(1).max(200).nullable(),
      rationale: z.string().trim().max(500),
    })
  ).max(200),
  classSuggestions: z.array(
    z.object({
      sourceValue: z.string().trim().min(1).max(300),
      suggestedGradeName: z.string().trim().max(200).nullable(),
      suggestedClassName: z.string().trim().max(200).nullable(),
      rationale: z.string().trim().max(500),
    })
  ).max(200),
});

export type TeacherImportLeoSuggestion = z.infer<typeof LeoTeacherImportSchema>;

const LeoTeacherHeaderSchema = z.object({
  headerSuggestions: z.array(
    z.object({
      sourceHeader: z.string().trim().min(1).max(200),
      canonicalField: z.enum(TEACHER_IMPORT_CANONICAL_FIELDS).nullable(),
      confidence: z.number().min(0).max(1),
      rationale: z.string().trim().max(300),
    })
  ).max(100),
});

export type TeacherImportHeaderSuggestion = {
  sourceHeader: string;
  canonicalField: TeacherImportCanonicalField | null;
  confidence: number;
  rationale: string;
};

export type TeacherImportLeoResult =
  | { ok: true; suggestions: TeacherImportLeoSuggestion }
  | { ok: false; unavailable: true; reason: string };

export async function suggestTeacherImportSemantics(input: {
  schoolId: mongoose.Types.ObjectId;
  unresolvedSubjects: string[];
  unresolvedClasses: string[];
  subjectCatalog: Array<{ subjectFamily: string; displayName: string; shortName: string; gradeBand: string; stage: string }>;
  gradeCatalog: string[];
  classCatalog: Array<{ gradeName: string; className: string }>;
}): Promise<TeacherImportLeoResult> {
  if (!input.unresolvedSubjects.length && !input.unresolvedClasses.length) {
    return { ok: true, suggestions: { subjectSuggestions: [], classSuggestions: [] } };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, unavailable: true, reason: "OPENAI_API_KEY is not configured." };
  }

  const access = await resolveLeoAccess({ schoolId: input.schoolId, role: "school_admin" });
  if (!access.effectiveEnabled) {
    return { ok: false, unavailable: true, reason: access.reasonDetail || "Leo assistance is disabled." };
  }

  const prompt = [
    "Interpret ambiguous teacher-import vocabulary for an education system.",
    "Return JSON only. Never return database IDs. Never invent a subject, grade, or class.",
    "Only suggest a subject family or a grade/class spelling that appears in the supplied catalogs.",
    "The source values below are unique labels only; do not request or infer teacher names, emails, phones, or other personal data.",
    `UNRESOLVED_SUBJECTS: ${JSON.stringify(input.unresolvedSubjects.slice(0, 200))}`,
    `UNRESOLVED_CLASSES: ${JSON.stringify(input.unresolvedClasses.slice(0, 200))}`,
    `SUBJECT_CATALOG: ${JSON.stringify(input.subjectCatalog.slice(0, 500))}`,
    `GRADE_CATALOG: ${JSON.stringify(input.gradeCatalog.slice(0, 200))}`,
    `CLASS_CATALOG: ${JSON.stringify(input.classCatalog.slice(0, 500))}`,
    'Shape: {"subjectSuggestions":[{"sourceValue":string,"suggestedSubjectFamily":string|null,"rationale":string}],"classSuggestions":[{"sourceValue":string,"suggestedGradeName":string|null,"suggestedClassName":string|null,"rationale":string}]}',
  ].join("\n\n");

  try {
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 }).chat.completions.create({
      model: process.env.LEO_IMPORT_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are Leo. Give cautious, reviewable suggestions. Structured JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 5000,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, unavailable: true, reason: "Leo returned an empty response." };
    const parsed = LeoTeacherImportSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return { ok: false, unavailable: true, reason: "Leo returned an invalid structured response." };
    return { ok: true, suggestions: parsed.data };
  } catch (error) {
    return { ok: false, unavailable: true, reason: error instanceof Error ? error.message : "Leo assistance failed." };
  }
}

/**
 * Header assistance is deliberately privacy-safe: Leo receives header labels
 * and the fixed canonical-field vocabulary only, never spreadsheet cell data.
 */
export async function suggestTeacherImportHeaders(input: {
  schoolId: mongoose.Types.ObjectId;
  unresolvedHeaders: string[];
}): Promise<
  | { ok: true; suggestions: TeacherImportHeaderSuggestion[] }
  | { ok: false; unavailable: true; reason: string }
> {
  if (!input.unresolvedHeaders.length) return { ok: true, suggestions: [] };
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, unavailable: true, reason: "OPENAI_API_KEY is not configured." };
  }
  const access = await resolveLeoAccess({ schoolId: input.schoolId, role: "school_admin" });
  if (!access.effectiveEnabled) {
    return { ok: false, unavailable: true, reason: access.reasonDetail || "Leo assistance is disabled." };
  }
  try {
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 })
      .chat.completions.create({
        model: process.env.LEO_IMPORT_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Leo. Map spreadsheet header labels cautiously. Return JSON only. You receive no row values, personal data, database IDs, or school data.",
          },
          {
            role: "user",
            content: [
              "Map only when confident. Do not invent fields. Use null when unclear.",
              `UNRESOLVED_HEADERS: ${JSON.stringify(input.unresolvedHeaders.slice(0, 100))}`,
              `CANONICAL_FIELDS: ${JSON.stringify(TEACHER_IMPORT_CANONICAL_FIELDS)}`,
              'Shape: {"headerSuggestions":[{"sourceHeader":string,"canonicalField":string|null,"confidence":number,"rationale":string}]}',
            ].join("\n\n"),
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });
    const content = completion.choices[0]?.message?.content;
    if (!content) return { ok: false, unavailable: true, reason: "Leo returned an empty response." };
    const parsed = LeoTeacherHeaderSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return { ok: false, unavailable: true, reason: "Leo returned an invalid structured response." };
    return { ok: true, suggestions: parsed.data.headerSuggestions };
  } catch (error) {
    return { ok: false, unavailable: true, reason: error instanceof Error ? error.message : "Leo assistance failed." };
  }
}
