import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { ensureDefaultExamTypesForSchool } from "@/lib/examinations/exam-type-seeds";
import {
  objectId,
  optionalObjectId,
  validateExamPaperAcademicRefs,
} from "@/lib/examinations/paper-validation";
import { serializeExamPaper } from "@/lib/examinations/serializers";
import { EXAM_PAPER_SCOPES, EXAM_PAPER_SOURCE_MODES } from "@/constants/examinations";
import { ExamPaper } from "@/models/ExamPaper";

const createPaperSchema = z.object({
  title: z.string().trim().min(3).max(220),
  examTypeId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  termId: z.string().trim().min(1).nullable().optional(),
  academicPeriodId: z.string().trim().min(1).nullable().optional(),
  scope: z.enum(EXAM_PAPER_SCOPES).default("class_group"),
  gradeId: z.string().trim().min(1),
  classGroupId: z.string().trim().min(1).nullable().optional(),
  classGroupIds: z.array(z.string().trim().min(1)).default([]),
  subjectId: z.string().trim().min(1),
  teacherId: z.string().trim().min(1).nullable().optional(),
  leadSetterId: z.string().trim().min(1).nullable().optional(),
  contributorIds: z.array(z.string().trim().min(1)).default([]),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  totalMarks: z.number().min(0).default(0),
  instructions: z.string().trim().max(8000).nullable().optional(),
  candidateInstructions: z.string().trim().max(8000).nullable().optional(),
  scheduledExamDate: z.string().trim().min(1).nullable().optional(),
  sourceMode: z.enum(EXAM_PAPER_SOURCE_MODES).default("manual"),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const gradeId = searchParams.get("gradeId");
    const subjectId = searchParams.get("subjectId");
    const examTypeId = searchParams.get("examTypeId");
    const q = searchParams.get("q")?.trim();
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || "24"), 1),
      100
    );

    const filter: Record<string, unknown> = { schoolId: ctx.schoolId };
    if (status) filter.status = status;
    if (gradeId) filter.gradeId = objectId(gradeId, "Grade");
    if (subjectId) filter.subjectId = objectId(subjectId, "Subject");
    if (examTypeId) filter.examTypeId = objectId(examTypeId, "Exam type");
    if (q) filter.title = { $regex: q, $options: "i" };

    const [papers, total] = await Promise.all([
      ExamPaper.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ExamPaper.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: papers.map(serializeExamPaper),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch exam papers",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireSchoolAdmin();
    // Subscription gate — no-op while SUBSCRIPTION_API_GATES_ENABLED=false
    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const examGate = await requireSchoolFeature(ctx.schoolId, FEATURE_KEYS.ASSESSMENT_EXAMINATIONS);
    if (!examGate.allowed) {
      return Response.json({ success: false, error: (examGate as any).reason }, { status: (examGate as any).statusCode ?? 403 });
    }
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const body = createPaperSchema.parse(await req.json());
    const examTypeId = objectId(body.examTypeId, "Exam type");
    const academicYearId = objectId(body.academicYearId, "Academic year");
    const termId = optionalObjectId(body.termId, "Term");
    const academicPeriodId =
      optionalObjectId(body.academicPeriodId, "Academic period") ?? termId;
    const gradeId = objectId(body.gradeId, "Grade");
    const classGroupId = optionalObjectId(body.classGroupId, "Class group");
    const subjectId = objectId(body.subjectId, "Subject");
    const teacherId = optionalObjectId(body.teacherId, "Teacher");
    const leadSetterId = optionalObjectId(body.leadSetterId, "Lead setter");
    const contributorIds = Array.from(new Set(body.contributorIds)).map((value) =>
      objectId(value, "Contributor")
    );
    const requestedClassGroupIds = body.classGroupIds.map((value) =>
      objectId(value, "Class group")
    );

    const { classGroupIds } = await validateExamPaperAcademicRefs({
      schoolId: ctx.schoolId,
      examTypeId,
      gradeId,
      subjectId,
      scope: body.scope,
      classGroupId,
      classGroupIds: requestedClassGroupIds,
    });

    const paper = await ExamPaper.create({
      schoolId: ctx.schoolId,
      title: body.title,
      examTypeId,
      academicYearId,
      termId,
      academicPeriodId,
      scope: body.scope,
      gradeId,
      classGroupId: body.scope === "class_group" ? classGroupIds[0] : null,
      classGroupIds,
      subjectId,
      teacherId,
      leadSetterId,
      contributorIds,
      setBy: ctx.userId,
      createdBy: ctx.userId,
      ownerRole: "admin",
      durationMinutes: body.durationMinutes ?? null,
      totalMarks: body.totalMarks,
      instructions: body.instructions ?? null,
      candidateInstructions: body.candidateInstructions ?? null,
      status: "draft",
      sourceMode: body.sourceMode,
      scheduledExamDate: body.scheduledExamDate
        ? new Date(body.scheduledExamDate)
        : null,
    });

    return Response.json(
      { success: true, data: serializeExamPaper(paper.toObject()) },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const isValidationError = error instanceof z.ZodError || error instanceof Error;
    return Response.json(
      {
        success: false,
        error: isValidationError
          ? error.message
          : "Failed to create exam paper",
      },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}
