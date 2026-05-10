import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { can } from "@/lib/auth/can";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  objectId,
  optionalObjectId,
  validateExamPaperAcademicRefs,
  validateTeacherCanSetPaper,
} from "@/lib/examinations/paper-validation";
import { ensureDefaultExamTypesForSchool } from "@/lib/examinations/exam-type-seeds";
import { serializeExamPaper } from "@/lib/examinations/serializers";
import { PERMISSIONS } from "@/lib/rbac";
import { EXAM_PAPER_SCOPES, EXAM_PAPER_SOURCE_MODES } from "@/constants/examinations";
import { ExamPaper } from "@/models/ExamPaper";

const createTeacherPaperSchema = z.object({
  title: z.string().trim().min(3).max(220),
  examTypeId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  termId: z.string().trim().min(1).nullable().optional(),
  academicPeriodId: z.string().trim().min(1),
  scope: z.enum(EXAM_PAPER_SCOPES).default("class_group"),
  gradeId: z.string().trim().min(1),
  classGroupId: z.string().trim().min(1).nullable().optional(),
  classGroupIds: z.array(z.string().trim().min(1)).default([]),
  subjectId: z.string().trim().min(1),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  totalMarks: z.number().min(0).default(0),
  instructions: z.string().trim().max(8000).nullable().optional(),
  candidateInstructions: z.string().trim().max(8000).nullable().optional(),
  scheduledExamDate: z.string().trim().min(1).nullable().optional(),
  sourceMode: z.enum(EXAM_PAPER_SOURCE_MODES).default("manual"),
});

export async function GET(req: Request) {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || "24"), 1),
      100
    );

    const filter: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      $or: [
        { teacherId: ctx.teacherId },
        { leadSetterId: ctx.teacherId },
        { contributorIds: ctx.teacherId },
        { createdBy: ctx.userId },
      ],
    };
    if (status) filter.status = status;

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
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.examsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const body = createTeacherPaperSchema.parse(await req.json());
    const examTypeId = objectId(body.examTypeId, "Exam type");
    const academicYearId = objectId(body.academicYearId, "Academic year");
    const termId = optionalObjectId(body.termId, "Term");
    const academicPeriodId = objectId(body.academicPeriodId, "Academic period");
    const gradeId = objectId(body.gradeId, "Grade");
    const classGroupId = optionalObjectId(body.classGroupId, "Class group");
    const subjectId = objectId(body.subjectId, "Subject");
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

    await validateTeacherCanSetPaper({
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
      academicPeriodId,
      subjectId,
      classGroupIds,
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
      teacherId: ctx.teacherId,
      leadSetterId: ctx.teacherId,
      contributorIds: [],
      setBy: ctx.userId,
      createdBy: ctx.userId,
      ownerRole: ctx.isAdmin ? "admin" : "teacher",
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
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create exam paper",
      },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}
