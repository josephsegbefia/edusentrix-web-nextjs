import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { parseExamPaperId } from "@/lib/examinations/paper-detail";
import { approveExamPaper } from "@/lib/examinations/paper-lifecycle";
import { ExamPaper } from "@/models/ExamPaper";
import { ExamPaperReview } from "@/models/ExamPaperReview";

const reviewSchema = z.object({
  decision: z.enum(["approved", "needs_revision", "rejected"]),
  comment: z.string().trim().max(8000).optional(),
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

    const reviews = await ExamPaperReview.find({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({
      success: true,
      data: reviews.map((review) => ({
        id: String(review._id),
        examPaperId: String(review.examPaperId),
        reviewerId: String(review.reviewerId),
        decision: review.decision,
        comment: review.comment ?? null,
        createdAt: review.createdAt?.toISOString?.() ?? null,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const parsed = reviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ success: false, error: "Validation failed" }, { status: 400 });
    }

    if (parsed.data.decision === "approved") {
      const result = await approveExamPaper({
        schoolId: ctx.schoolId,
        examPaperId: paperId,
        userId: ctx.userId,
        comment: parsed.data.comment,
      });
      if ("error" in result) {
        return Response.json({ success: false, error: result.error }, { status: result.status });
      }
      return Response.json({ success: true });
    }

    const nextStatus =
      parsed.data.decision === "needs_revision" ? "needs_revision" : "draft";
    const paper = await ExamPaper.findOneAndUpdate(
      { _id: paperId, schoolId: ctx.schoolId, status: { $in: ["submitted", "needs_revision"] } },
      { $set: { status: nextStatus } },
      { new: true }
    );
    if (!paper) {
      return Response.json(
        { success: false, error: "Only submitted papers can be reviewed" },
        { status: 409 }
      );
    }

    await ExamPaperReview.create({
      schoolId: ctx.schoolId,
      examPaperId: paperId,
      reviewerId: ctx.userId,
      decision: parsed.data.decision,
      comment: parsed.data.comment || null,
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to review exam paper" },
      { status: 500 }
    );
  }
}
