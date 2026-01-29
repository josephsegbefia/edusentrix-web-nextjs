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
    const submissionId = toObjectIdOrNull(id);

    if (!submissionId) {
      return Response.json({ success: false, error: "Invalid submission ID" }, { status: 400 });
    }

    const submission = await Submission.findById(submissionId)
      .populate("studentId", "firstName lastName admissionNo photoUrl")
      .lean();

    if (!submission) {
      return Response.json({ success: false, error: "Submission not found" }, { status: 404 });
    }

    const assignment = await Homework.findOne({
      _id: submission.homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .populate("subjectId", "name")
      .populate("rubricId", "title criteria")
      .lean();

    if (!assignment) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return Response.json({
      success: true,
      data: {
        submission: {
          id: String(submission._id),
          status: submission.status,
          content: submission.content || "",
          attachments: submission.attachments || [],
          submittedAt: submission.submittedAt ? submission.submittedAt.toISOString() : null,
          isLate: submission.isLate || false,
          score: submission.score ?? null,
          feedback: submission.feedback ?? null,
          rubricScores: submission.rubricScores || {},
          gradedAt: submission.gradedAt ? submission.gradedAt.toISOString() : null,
          publishedAt: submission.publishedAt ? submission.publishedAt.toISOString() : null,
          returnedAt: submission.returnedAt ? submission.returnedAt.toISOString() : null,
          returnReason: submission.returnReason || null,
          student: submission.studentId
            ? {
                id: String(submission.studentId._id || submission.studentId),
                name: `${submission.studentId.firstName || ""} ${submission.studentId.lastName || ""}`.trim(),
                admissionNo: submission.studentId.admissionNo || undefined,
                photoUrl: submission.studentId.photoUrl || undefined,
              }
            : null,
        },
        assignment: {
          id: String(assignment._id),
          title: assignment.title,
          instructions: assignment.instructions,
          status: assignment.status,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          maxScore: assignment.maxScore,
          subject: assignment.subjectId
            ? {
                id: String(assignment.subjectId._id || assignment.subjectId),
                name: assignment.subjectId.name,
              }
            : null,
          rubric: assignment.rubricId
            ? {
                id: String(assignment.rubricId._id || assignment.rubricId),
                title: assignment.rubricId.title,
                criteria: assignment.rubricId.criteria || [],
              }
            : null,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load submission:", e);
    const message = e instanceof Error ? e.message : "Failed to load submission";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
