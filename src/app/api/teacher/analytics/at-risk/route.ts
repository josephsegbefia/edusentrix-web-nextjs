import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { calculateAtRiskStudents } from "@/lib/teacher/analytics";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : null;

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: mongoose.Types.ObjectId } | null;

    if (!period) {
      return Response.json({ success: true, data: { students: [], total: 0, thresholds: {} } });
    }

    let classGroupIds: mongoose.Types.ObjectId[] = [];
    let classGroupObjId: mongoose.Types.ObjectId | null = null;

    if (classGroupId) {
      classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }

      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: classGroupObjId,
          academicPeriodId: period._id,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }

      classGroupIds = [classGroupObjId];
    } else {
      const assignments = await TeacherAssignment.find({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        academicPeriodId: period._id,
        status: "active",
      })
        .select("classGroupId")
        .lean();

      classGroupIds = Array.from(
        new Set(assignments.map((assignment) => String(assignment.classGroupId)))
      ).map((id) => new mongoose.Types.ObjectId(id));
    }

    const result = await calculateAtRiskStudents({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId: period._id,
      classGroupIds,
    });

    const students = limit && Number.isFinite(limit) && limit > 0
      ? result.students.slice(0, Math.floor(limit))
      : result.students;

    return Response.json({
      success: true,
      data: {
        students,
        total: result.total,
        thresholds: result.thresholds,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load at-risk analytics:", e);
    const message = e instanceof Error ? e.message : "Failed to load at-risk analytics";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
