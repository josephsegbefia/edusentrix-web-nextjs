/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import {
  buildDefaultStudentIdPattern,
  buildSchoolPrefix,
  buildStudentIdPatternDraft,
  extractRequiredFieldsFromTemplate,
  generateAdmissionNoFromPattern,
  missingFieldsForPattern,
  sanitizeStudentIdTemplate,
  type StudentIdPatternDraft,
} from "@/lib/students/student-id-pattern";

export const dynamic = "force-dynamic";

const GenerateBodySchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  dateOfBirth: z.string().trim().optional(),
  enrolledAt: z.string().trim().optional(),
  gradeId: z.string().trim().optional(),
  classGroupId: z.string().trim().optional(),
  patternHint: z.string().trim().optional(),
  patternDraft: z
    .object({
      template: z.string().trim().min(1),
      source: z.enum(["leo", "standard"]),
      explanation: z.string().trim().optional().nullable(),
      requiredFields: z
        .array(
          z.enum(["firstName", "lastName", "dateOfBirth", "enrolledAt", "gradeId", "classGroupId"])
        )
        .optional(),
    })
    .optional(),
});

const SavePatternSchema = z.object({
  patternDraft: z.object({
    template: z.string().trim().min(1),
    source: z.enum(["leo", "standard"]),
    explanation: z.string().trim().optional().nullable(),
    requiredFields: z.array(
      z.enum(["firstName", "lastName", "dateOfBirth", "enrolledAt", "gradeId", "classGroupId"])
    ),
  }),
});

type LeoPatternSuggestion = {
  template: string;
  explanation: string;
};

async function suggestPatternWithLeo(input: {
  patternHint: string;
  schoolName: string;
  schoolPrefix: string;
}): Promise<LeoPatternSuggestion | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          `You are Leo, EduSentrix's student-ID setup assistant. Return ONLY valid JSON with this shape: ` +
          `{ "template": string, "explanation": string }.\n\n` +
          `Build one reusable student ID template using only these placeholders:\n` +
          `{schoolPrefix}, {enrollYear2}, {enrollYear4}, {birthMonth2}, {birthYear2}, {birthYear4}, {initials}, {firstInitial}, {lastInitial}, {gradeCode}, {classCode}, {sequence3}, {sequence4}, {sequence5}\n\n` +
          `Rules:\n` +
          `- Use only uppercase letters, digits, hyphens, underscores, and placeholders.\n` +
          `- The template must include at least one sequence placeholder.\n` +
          `- Prefer schoolPrefix over long literals.\n` +
          `- If the admin hint requests data outside the student form, approximate with the closest supported placeholders and explain that briefly.\n` +
          `- Output a reusable pattern, not one concrete student ID.\n`,
      },
      {
        role: "user",
        content: JSON.stringify({
          patternHint: input.patternHint,
          schoolName: input.schoolName,
          schoolPrefix: input.schoolPrefix,
        }),
      },
    ],
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { template?: string; explanation?: string };
    const template = sanitizeStudentIdTemplate(String(parsed.template || ""));
    const explanation =
      typeof parsed.explanation === "string" ? parsed.explanation.trim() : "";
    if (!template.includes("{sequence")) return null;
    if (!template) return null;
    return { template, explanation };
  } catch {
    return null;
  }
}

async function resolveSchoolContext(schoolId: mongoose.Types.ObjectId) {
  const [school, settings] = await Promise.all([
    School.findById(schoolId).select("name").lean(),
    SchoolSettings.findOne({ schoolId }).select("studentIdGeneration").lean(),
  ]);

  const schoolName = (school as any)?.name ?? "School";
  const savedPatternRaw = (settings as any)?.studentIdGeneration?.defaultPattern;
  const savedPattern = savedPatternRaw
    ? buildStudentIdPatternDraft(savedPatternRaw as Partial<StudentIdPatternDraft>)
    : null;

  return {
    schoolName,
    savedPattern,
  };
}

async function resolveAcademicLabels(args: {
  schoolId: mongoose.Types.ObjectId;
  gradeId?: string;
  classGroupId?: string;
}) {
  const { schoolId, gradeId, classGroupId } = args;
  let gradeName: string | null = null;
  let classGroupName: string | null = null;

  if (gradeId && mongoose.Types.ObjectId.isValid(gradeId)) {
    const grade = await Grade.findOne({ _id: gradeId, schoolId }).select("name").lean();
    gradeName = (grade as any)?.name ?? null;
  }

  if (classGroupId && mongoose.Types.ObjectId.isValid(classGroupId)) {
    const classGroup = await ClassGroup.findOne({ _id: classGroupId, schoolId })
      .select("name")
      .lean();
    classGroupName = (classGroup as any)?.name ?? null;
  }

  return { gradeName, classGroupName };
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]);
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { savedPattern } = await resolveSchoolContext(schoolIdObj);

    return NextResponse.json({
      success: true,
      data: {
        savedPattern,
        hasSavedPattern: Boolean(savedPattern),
      },
    });
  } catch (error) {
    console.error("Generate student ID settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load student ID settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]);
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const parsed = SavePatternSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const patternDraft = buildStudentIdPatternDraft(parsed.data.patternDraft);
    const now = new Date();

    await SchoolSettings.findOneAndUpdate(
      { schoolId: schoolIdObj },
      {
        $set: {
          studentIdGeneration: {
            defaultPattern: {
              ...patternDraft,
              savedAt: now,
              updatedAt: now,
            },
          },
          updatedBy: new mongoose.Types.ObjectId(String(userId)),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        savedPattern: patternDraft,
      },
    });
  } catch (error) {
    console.error("Generate student ID settings PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save student ID pattern" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]);
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const parsed = GenerateBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { schoolName, savedPattern } = await resolveSchoolContext(schoolIdObj);
    const { gradeName, classGroupName } = await resolveAcademicLabels({
      schoolId: schoolIdObj,
      gradeId: body.gradeId,
      classGroupId: body.classGroupId,
    });

    const schoolPrefix = buildSchoolPrefix(schoolName);
    const patternHint = body.patternHint?.trim() || "";

    let patternDraft = body.patternDraft
      ? buildStudentIdPatternDraft(body.patternDraft)
      : savedPattern;
    let source: "saved" | "leo" | "standard" = savedPattern ? "saved" : "standard";
    let leoExplanation: string | null = null;
    let requiresSaveConfirmation = false;

    if (patternHint.length >= 3 && !body.patternDraft) {
      const leo = await suggestPatternWithLeo({
        patternHint,
        schoolName,
        schoolPrefix,
      });

      if (leo) {
        patternDraft = buildStudentIdPatternDraft({
          template: leo.template,
          source: "leo",
          explanation: leo.explanation,
          requiredFields: extractRequiredFieldsFromTemplate(leo.template),
        });
        source = "leo";
        leoExplanation = leo.explanation;
        requiresSaveConfirmation = !savedPattern;
      }
    }

    if (!patternDraft) {
      patternDraft = buildDefaultStudentIdPattern();
      source = "standard";
    }

    const missingFields = missingFieldsForPattern(patternDraft, {
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      enrolledAt: body.enrolledAt,
      gradeName,
      classGroupName,
    });

    if (missingFields.length > 0) {
      return NextResponse.json({
        success: true,
        admissionNo: null,
        source,
        savedPattern,
        patternDraft,
        requiresSaveConfirmation,
        leoExplanation,
        missingFields,
        message: "Complete the required fields to generate this school’s student ID.",
      });
    }

    const generated = await generateAdmissionNoFromPattern(patternDraft, {
      schoolId: schoolIdObj,
      schoolName,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      enrolledAt: body.enrolledAt,
      gradeName,
      classGroupName,
    });

    return NextResponse.json({
      success: true,
      admissionNo: generated.admissionNo,
      source,
      patternDraft,
      savedPattern,
      requiresSaveConfirmation,
      leoExplanation,
      missingFields: [],
      breakdown: generated.breakdown,
    });
  } catch (e: unknown) {
    console.error("Generate student ID error:", e);
    const message = e instanceof Error ? e.message : "Failed to generate student ID";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
