import OpenAI from "openai";
import { z } from "zod";

import {
  buildGradeStreamConstraints,
  expandAllStreamAssignments,
  tryDeterministicAssignments,
  type GradeLite,
  type OfferingMatchLite,
  type ParsedAssignmentRow,
} from "@/lib/leo/parse-teacher-assignment-hint";

const semanticRelationshipSchema = z.object({
  explanation: z.string().max(1200).default(""),
  relationships: z.array(z.object({
    kind: z.enum(["subject", "assignment", "homeroom"]),
    subject: z.string().max(200).optional(),
    grade: z.string().max(120).optional(),
    stream: z.string().max(80).optional(),
  }).strict()).max(100),
}).strict();

export type TeacherRelationshipInterpretation = {
  explanation: string;
  assignments: ParsedAssignmentRow[];
  homerooms: Array<{ grade: string; stream: string }>;
};

export type TeacherRelationshipContext = {
  grades: GradeLite[];
  subjectOfferings: Array<Pick<OfferingMatchLite, "id" | "displayName" | "shortName" | "code" | "gradeBand"> & { gradeNames: string[] }>;
  classGroups: Array<{ stream: string; gradeName: string }>;
};

/**
 * The semantic Leo contract used by the working Teacher Overview experience.
 * Server-owned import metadata is deliberately not part of this response.
 */
export async function interpretTeacherTeachingRelationships(input: {
  hint: string;
  context: TeacherRelationshipContext;
  useDeterministicFirst?: boolean;
}): Promise<TeacherRelationshipInterpretation> {
  const constraints = buildGradeStreamConstraints(input.hint, input.context.grades);
  const deterministic = [
    ...tryDeterministicAssignments(input.hint, input.context.grades, constraints),
    ...expandAllStreamAssignments(
      input.hint,
      input.context.grades,
      constraints,
      input.context.classGroups.map((group) => ({ name: group.stream, gradeId: input.context.grades.find((grade) => grade.name === group.gradeName)?.id || "" }))
    ),
  ];
  if (input.useDeterministicFirst !== false && deterministic.length > 0) {
    return { explanation: "I matched your note to the school catalogue.", assignments: deterministic, homerooms: [] };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { explanation: "Leo is not configured in this environment.", assignments: [], homerooms: [] };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: process.env.LEO_IMPORT_MODEL || "gpt-4o-mini",
    temperature: 0.15,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are Leo, assisting a Ghanaian school admin. Interpret the teacher's plain-language relationship instruction.
Return ONLY JSON with this exact shape: { "explanation": string, "relationships": [{ "kind": "subject" | "assignment" | "homeroom", "subject"?: string, "grade"?: string, "stream"?: string }] }.
Use only the supplied grades, class streams, and subject offerings. Never invent IDs or database values.
For subject-only teaching, return kind subject with subject and grade and no stream.
For explicit class teaching, return kind assignment with subject, grade, and stream. If multiple classes are named, return one assignment per class.
For homeroom language, return kind homeroom with grade and stream only. Do not infer homeroom from teaching an assignment.
Keep stream as the suffix only (A, B, Rose), not the full class name. If the instruction is ambiguous or cannot be matched safely, return an empty relationships array.

CATALOG:
${JSON.stringify(input.context)}`,
      },
      { role: "user", content: input.hint },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Leo returned an empty response");
  const parsed = semanticRelationshipSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error("Leo returned an invalid relationship response");

  const assignments: ParsedAssignmentRow[] = [];
  const homerooms: Array<{ grade: string; stream: string }> = [];
  for (const relationship of parsed.data.relationships) {
    if (!relationship.grade || !relationship.stream) {
      if (relationship.kind === "subject" && relationship.subject && relationship.grade) {
        assignments.push({ subject: relationship.subject, grade: relationship.grade, stream: "" });
      }
      continue;
    }
    if (relationship.kind === "homeroom") homerooms.push({ grade: relationship.grade, stream: relationship.stream });
    if (relationship.kind === "assignment" && relationship.subject) assignments.push({ subject: relationship.subject, grade: relationship.grade, stream: relationship.stream });
  }
  return { explanation: parsed.data.explanation, assignments, homerooms };
}
