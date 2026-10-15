import { z } from "zod";
import mongoose from "mongoose";
import type {
  RunLeoImportIntelligenceInput,
  RunLeoImportIntelligenceResult,
} from "@/lib/import-intelligence/leo";
import type { ImportLeoMetadata } from "@/lib/import-intelligence/types";

async function runImportLeo<T>(input: RunLeoImportIntelligenceInput<T>): Promise<RunLeoImportIntelligenceResult<T>> {
  const { runLeoImportIntelligence } = await import("@/lib/import-intelligence/leo");
  return runLeoImportIntelligence(input);
}

const schema = z.object({
  gradeSuggestions: z.array(z.object({ sourceValue: z.string().trim().min(1).max(200), suggestedGradeName: z.string().trim().max(200).nullable(), rationale: z.string().trim().max(500) })).max(100),
  classSuggestions: z.array(z.object({ sourceValue: z.string().trim().min(1).max(200), suggestedGradeName: z.string().trim().max(200).nullable(), suggestedClassName: z.string().trim().max(200).nullable(), rationale: z.string().trim().max(500) })).max(100),
});

export type StudentImportLeoResult =
  | { ok: true; suggestions: z.infer<typeof schema>; metadata?: ImportLeoMetadata }
  | { ok: false; unavailable: true; reason: string; metadata?: ImportLeoMetadata };

export function buildStudentImportLeoPrompt(input: { unresolvedGrades: string[]; unresolvedClasses: string[]; sexValues: string[]; statusValues: string[]; gradeCatalog: string[]; classCatalog: Array<{ gradeName: string; className: string }> }) {
  return JSON.stringify({
    instruction: "Interpret ambiguous structural values for a school student import. Return only the requested JSON shape.",
    unresolvedGrades: input.unresolvedGrades.slice(0, 100),
    unresolvedClasses: input.unresolvedClasses.slice(0, 100),
    sexValues: input.sexValues.slice(0, 50),
    statusValues: input.statusValues.slice(0, 50),
    gradeCatalog: input.gradeCatalog.slice(0, 200),
    classCatalog: input.classCatalog.slice(0, 500),
    exclusions: ["student names", "dates of birth, admission numbers", "guardian data", "email", "phone", "GES identifiers", "raw rows", "database ids", "Never return database IDs"],
  });
}

export async function suggestStudentImportSemantics(input: { schoolId: mongoose.Types.ObjectId; unresolvedGrades: string[]; unresolvedClasses: string[]; sexValues: string[]; statusValues: string[]; gradeCatalog: string[]; classCatalog: Array<{ gradeName: string; className: string }> }): Promise<StudentImportLeoResult> {
  const result = await runImportLeo({
    domain: "student",
    task: "interpret_vocabulary",
    schoolId: input.schoolId,
    authorized: true,
    context: buildStudentImportLeoPrompt(input),
    responseSchema: schema,
    inputCount: input.unresolvedGrades.length + input.unresolvedClasses.length,
  });
  return result.ok
    ? { ok: true, suggestions: result.data, metadata: result.metadata }
    : { ok: false, unavailable: true, reason: result.metadata.reason || "Leo assistance was unavailable.", metadata: result.metadata };
}
