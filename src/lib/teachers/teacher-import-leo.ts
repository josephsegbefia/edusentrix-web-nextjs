import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";
import { resolveLeoAccess } from "@/lib/leo/access";

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
