import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";
import { resolveLeoAccess } from "@/lib/leo/access";

const schema = z.object({
  gradeSuggestions: z.array(z.object({ sourceValue: z.string().trim().min(1).max(200), suggestedGradeName: z.string().trim().max(200).nullable(), rationale: z.string().trim().max(500) })).max(100),
  classSuggestions: z.array(z.object({ sourceValue: z.string().trim().min(1).max(200), suggestedGradeName: z.string().trim().max(200).nullable(), suggestedClassName: z.string().trim().max(200).nullable(), rationale: z.string().trim().max(500) })).max(100),
});
export type StudentImportLeoResult = { ok: true; suggestions: z.infer<typeof schema> } | { ok: false; unavailable: true; reason: string };

export function buildStudentImportLeoPrompt(input: { unresolvedGrades: string[]; unresolvedClasses: string[]; sexValues: string[]; statusValues: string[]; gradeCatalog: string[]; classCatalog: Array<{ gradeName: string; className: string }> }) {
  return [
    "Interpret ambiguous structural values for a school student import.",
    "Return JSON only. Never return database IDs. Never invent a grade or class.",
    "The source values are categorical labels only. Student names, dates of birth, admission numbers, guardian data, and source rows are intentionally excluded.",
    `UNRESOLVED_GRADES: ${JSON.stringify(input.unresolvedGrades.slice(0, 100))}`,
    `UNRESOLVED_CLASSES: ${JSON.stringify(input.unresolvedClasses.slice(0, 100))}`,
    `SEX_VALUES: ${JSON.stringify(input.sexValues.slice(0, 50))}`,
    `STATUS_VALUES: ${JSON.stringify(input.statusValues.slice(0, 50))}`,
    `GRADE_CATALOG: ${JSON.stringify(input.gradeCatalog.slice(0, 200))}`,
    `CLASS_CATALOG: ${JSON.stringify(input.classCatalog.slice(0, 500))}`,
    'Shape: {"gradeSuggestions":[{"sourceValue":string,"suggestedGradeName":string|null,"rationale":string}],"classSuggestions":[{"sourceValue":string,"suggestedGradeName":string|null,"suggestedClassName":string|null,"rationale":string}]}',
  ].join("\n\n");
}

export async function suggestStudentImportSemantics(input: { schoolId: mongoose.Types.ObjectId; unresolvedGrades: string[]; unresolvedClasses: string[]; sexValues: string[]; statusValues: string[]; gradeCatalog: string[]; classCatalog: Array<{ gradeName: string; className: string }> }): Promise<StudentImportLeoResult> {
  if (!input.unresolvedGrades.length && !input.unresolvedClasses.length) return { ok: true, suggestions: { gradeSuggestions: [], classSuggestions: [] } };
  if (!process.env.OPENAI_API_KEY) return { ok: false, unavailable: true, reason: "OPENAI_API_KEY is not configured." };
  const access = await resolveLeoAccess({ schoolId: input.schoolId, role: "school_admin" });
  if (!access.effectiveEnabled) return { ok: false, unavailable: true, reason: access.reasonDetail || "Leo assistance is disabled." };
  try {
    const completion = await new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 }).chat.completions.create({ model: process.env.LEO_IMPORT_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: "You are Leo. Be cautious and return structured JSON only." }, { role: "user", content: buildStudentImportLeoPrompt(input) }], temperature: 0, response_format: { type: "json_object" }, max_tokens: 4000 });
    const content = completion.choices[0]?.message?.content;
    const parsed = content ? schema.safeParse(JSON.parse(content)) : null;
    return parsed?.success ? { ok: true, suggestions: parsed.data } : { ok: false, unavailable: true, reason: "Leo returned an invalid structured response." };
  } catch (error) {
    return { ok: false, unavailable: true, reason: error instanceof Error ? error.message : "Leo assistance failed." };
  }
}
