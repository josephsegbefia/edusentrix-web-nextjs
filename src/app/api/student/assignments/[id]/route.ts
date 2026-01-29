import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { requireTeacherStudioFeature } from "@/lib/features/teacherStudio";

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
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    await requireTeacherStudioFeature(context.schoolId);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);
    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const student = await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean() as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignment = (await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      status: { $in: ["published", "closed"] },
      classGroupIds: student.classGroupId,
      $or: [
        { targetStudentIds: { $exists: false } },
        { targetStudentIds: { $size: 0 } },
        { targetStudentIds: new mongoose.Types.ObjectId(String(student._id)) },
      ],
    })
      .populate("subjectId", "name")
      .populate("rubricId", "title criteria")
      .lean()) as any;

    if (!assignment) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        assignment: {
          id: String(assignment._id),
          title: assignment.title,
          instructions: assignment.instructions,
          type: assignment.type,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          status: assignment.status,
          maxScore: assignment.maxScore,
          latePolicy: assignment.latePolicy,
          latePenaltyPercent: assignment.latePenaltyPercent ?? null,
          attachments: assignment.attachments || [],
          subject: assignment.subjectId
            ? { id: String(assignment.subjectId._id || assignment.subjectId), name: assignment.subjectId.name }
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
    console.error("Failed to load assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to load assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
