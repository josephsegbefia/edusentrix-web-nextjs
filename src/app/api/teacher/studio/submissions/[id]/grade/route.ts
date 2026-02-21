import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

const GradeSchema = z.object({
  score: z.number().min(0).optional().nullable(),
  feedback: z.string().max(2000).optional().nullable(),
  rubricScores: z.record(z.string(), z.number()).optional(),
  publish: z.boolean().optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsGrade);

    const { id } = await ctx.params;
    const submissionId = toObjectIdOrNull(id);

    if (!submissionId) {
      return Response.json({ success: false, error: "Invalid submission ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = GradeSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return Response.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const assignment = await Homework.findOne({
      _id: submission.homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id")
      .lean();

    if (!assignment) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const update: Record<string, unknown> = {
      status: "graded",
      gradedBy: context.userId,
      gradedAt: new Date(),
    };

    if (parsed.data.score !== undefined) update.score = parsed.data.score;
    if (parsed.data.feedback !== undefined) update.feedback = parsed.data.feedback;
    if (parsed.data.rubricScores) update.rubricScores = parsed.data.rubricScores;

    if (parsed.data.publish) {
      update.publishedAt = new Date();
    }

    await Submission.updateOne({ _id: submissionId }, { $set: update });

    const [total, graded] = await Promise.all([
      Submission.countDocuments({ homeworkId: assignment._id }),
      Submission.countDocuments({ homeworkId: assignment._id, status: "graded" }),
    ]);

    await Homework.updateOne(
      { _id: assignment._id },
      { $set: { submissionCount: total, gradedCount: graded } }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to grade submission:", e);
    const message = e instanceof Error ? e.message : "Failed to grade submission";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
