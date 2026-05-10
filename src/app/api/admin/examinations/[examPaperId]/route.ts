import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  getSerializedExamPaperDetail,
  parseExamPaperId,
} from "@/lib/examinations/paper-detail";
import { serializeExamPaper } from "@/lib/examinations/serializers";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperReview } from "@/models/ExamPaperReview";
import { ExamPaperSection } from "@/models/ExamPaperSection";
import { ExamQuestion } from "@/models/ExamQuestion";

const patchPaperSchema = z.object({
  title: z.string().trim().min(3).max(220).optional(),
  durationMinutes: z.number().int().min(1).nullable().optional(),
  totalMarks: z.number().min(0).optional(),
  instructions: z.string().trim().max(8000).nullable().optional(),
  candidateInstructions: z.string().trim().max(8000).nullable().optional(),
  scheduledExamDate: z.string().trim().min(1).nullable().optional(),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }

    const detail = await getSerializedExamPaperDetail({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
    });
    if (!detail) return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    return Response.json({ success: true, data: detail });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch exam paper" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }
    const existing = await ExamPaper.findOne({ _id: paperId, schoolId: ctx.schoolId });
    if (!existing) return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    if (!["draft", "needs_revision"].includes(existing.status)) {
      return Response.json({ success: false, error: "Only draft or revision-requested papers can be edited" }, { status: 409 });
    }

    const parsed = patchPaperSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.title !== undefined) existing.title = parsed.data.title;
    if (parsed.data.durationMinutes !== undefined)
      existing.durationMinutes = parsed.data.durationMinutes;
    if (parsed.data.totalMarks !== undefined) existing.totalMarks = parsed.data.totalMarks;
    if (parsed.data.instructions !== undefined)
      existing.instructions = parsed.data.instructions;
    if (parsed.data.candidateInstructions !== undefined)
      existing.candidateInstructions = parsed.data.candidateInstructions;
    if (parsed.data.scheduledExamDate !== undefined) {
      existing.scheduledExamDate = parsed.data.scheduledExamDate
        ? new Date(parsed.data.scheduledExamDate)
        : null;
    }

    await existing.save();
    return Response.json({ success: true, data: serializeExamPaper(existing.toObject()) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update exam paper" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ examPaperId: string }> }
) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const { examPaperId } = await params;
    const paperId = parseExamPaperId(examPaperId);
    if (!paperId) {
      return Response.json({ success: false, error: "Invalid exam paper id" }, { status: 400 });
    }

    const existing = await ExamPaper.findOne({ _id: paperId, schoolId: ctx.schoolId });
    if (!existing) return Response.json({ success: false, error: "Exam paper not found" }, { status: 404 });
    if (!["draft", "needs_revision"].includes(existing.status)) {
      return Response.json({ success: false, error: "Only editable papers can be deleted" }, { status: 409 });
    }

    await Promise.all([
      ExamQuestion.deleteMany({ schoolId: ctx.schoolId, examPaperId: paperId }),
      ExamPaperSection.deleteMany({ schoolId: ctx.schoolId, examPaperId: paperId }),
      ExamPaperReview.deleteMany({ schoolId: ctx.schoolId, examPaperId: paperId }),
      ExamPaper.deleteOne({ _id: paperId, schoolId: ctx.schoolId }),
    ]);

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete exam paper" },
      { status: 500 }
    );
  }
}
