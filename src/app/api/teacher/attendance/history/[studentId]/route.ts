import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { TeacherAssignment } from "@/models/TeacherAssignment";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { studentId } = await ctx.params;
    const studentObjId = toObjectIdOrNull(studentId);
    if (!studentObjId) {
      return Response.json({ success: false, error: "Invalid student ID" }, { status: 400 });
    }

    const student = await Student.findOne({
      _id: studentObjId,
      schoolId: context.schoolId,
    })
      .select("_id classGroupId")
      .lean();

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const isHomeroom = context.homeroomClassGroupId
      ? String(context.homeroomClassGroupId) === String(student.classGroupId)
      : false;

    if (!context.isAdmin && !isHomeroom) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: student.classGroupId,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const type = searchParams.get("type") as "homeroom" | "period" | null;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      studentId: studentObjId,
    };

    if (type) query.type = type;

    const records = await StudentAttendance.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    return Response.json({
      success: true,
      data: {
        studentId: String(student._id),
        records: records.map((record) => ({
          _id: String(record._id),
          date: record.date.toISOString(),
          type: record.type,
          status: record.status,
          periodNumber: record.periodNumber ?? null,
          subjectId: record.subjectId ? String(record.subjectId) : null,
          lateMinutes: record.lateMinutes ?? null,
          reason: record.reason ?? null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch attendance history:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch attendance history";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
