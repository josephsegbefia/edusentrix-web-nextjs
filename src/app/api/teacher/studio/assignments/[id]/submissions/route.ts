import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Homework } from "@/models/Homework";
import { Submission } from "@/models/Submission";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);

    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const assignment = await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id title status dueDate maxScore")
      .lean();

    if (!assignment) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const submissions = await Submission.find({ homeworkId })
      .populate("studentId", "firstName lastName admissionNo photoUrl")
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const data = submissions.map((submission: any) => ({
      id: String(submission._id),
      status: submission.status,
      submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
      isLate: submission.isLate || false,
      score: submission.score ?? null,
      feedback: submission.feedback ?? null,
      gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
      publishedAt: submission.publishedAt ? submission.publishedAt.toISOString() : null,
      student: submission.studentId
        ? {
            id: String(submission.studentId._id || submission.studentId),
            name: `${submission.studentId.firstName || ""} ${submission.studentId.lastName || ""}`.trim(),
            admissionNo: submission.studentId.admissionNo || undefined,
            photoUrl: submission.studentId.photoUrl || undefined,
          }
        : null,
    }));

    const statusCounts = submissions.reduce(
      (acc: Record<string, number>, submission: any) => {
        acc[submission.status] = (acc[submission.status] || 0) + 1;
        return acc;
      },
      {}
    );

    return Response.json({
      success: true,
      data: {
        assignment: {
          id: String(assignment._id),
          title: assignment.title,
          status: assignment.status,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          maxScore: assignment.maxScore,
        },
        submissions: data,
        statusCounts,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load submissions:", e);
    const message = e instanceof Error ? e.message : "Failed to load submissions";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
