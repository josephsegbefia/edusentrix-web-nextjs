import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicPeriod } from "@/models/AcademicPeriod";
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

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: mongoose.Types.ObjectId } | null;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      status: { $in: ["published", "closed"] },
      classGroupIds: student.classGroupId,
    };

    if (period?._id) {
      query.academicPeriodId = period._id;
    }

    query.$or = [
      { targetStudentIds: { $exists: false } },
      { targetStudentIds: { $size: 0 } },
      { targetStudentIds: new mongoose.Types.ObjectId(String(student._id)) },
    ];

    const assignments = await Homework.find(query)
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
