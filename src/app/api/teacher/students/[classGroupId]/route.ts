import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ classGroupId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { classGroupId } = await ctx.params;
    const classGroupObjId = toObjectIdOrNull(classGroupId);

    if (!classGroupObjId) {
      return Response.json(
        { success: false, error: "Invalid class group ID" },
        { status: 400 }
      );
    }

    const isHomeroom = context.homeroomClassGroupId
      ? String(context.homeroomClassGroupId) === String(classGroupObjId)
      : false;

    if (!context.isAdmin && !isHomeroom) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo photoUrl")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    return Response.json({
      success: true,
      data: {
        students: students.map((student) => ({
          _id: String(student._id),
          firstName: student.firstName,
          lastName: student.lastName,
          middleName: student.middleName || undefined,
          admissionNo: student.admissionNo || undefined,
          photoUrl: student.photoUrl || undefined,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch class roster:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch class roster";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}
