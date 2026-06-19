import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import {
  buildStudentHomeworkVisibilityInput,
  buildStudentVisibleHomeworkFilter,
} from "@/lib/learn/student-homework-visibility";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { requireTeacherStudioFeature } from "@/lib/features/teacherStudio";

export async function GET() {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    await requireTeacherStudioFeature(context.schoolId);

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

    const period = await buildStudentHomeworkVisibilityInput(
      context.schoolId,
      student._id,
      student.classGroupId
    );

    const assignments = await Homework.find(buildStudentVisibleHomeworkFilter(period))
      .sort({ dueDate: 1 })
      .populate("subjectId", "name")
      .lean();

    return Response.json({
      success: true,
      data: {
        assignments: assignments.map((assignment: any) => ({
          id: String(assignment._id),
          title: assignment.title,
          type: assignment.type,
          dueDate: assignment.dueDate ? assignment.dueDate.toISOString() : null,
          status: assignment.status,
          maxScore: assignment.maxScore,
          subject: assignment.subjectId
            ? { id: String(assignment.subjectId._id || assignment.subjectId), name: assignment.subjectId.name }
            : null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load student assignments:", e);
    const message = e instanceof Error ? e.message : "Failed to load assignments";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
