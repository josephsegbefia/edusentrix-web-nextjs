import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Escalation } from "@/models/Escalation";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";

type EscalationStudentLite = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  admissionNo?: string | null;
};

const EscalationCreateSchema = z.object({
  studentId: z.string().optional(),
  type: z.enum(["discipline", "academic", "welfare", "other"]),
  title: z.string().min(1).max(160),
  description: z.string().min(1),
});

function toObjectIdOrNull(id?: string) {
  if (!id) return null;
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
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (context.isAdmin) {
      delete query.teacherId;
    }

    if (status) query.status = status;

    const escalations = await Escalation.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const studentIds = escalations.map((e) => e.studentId).filter(Boolean) as mongoose.Types.ObjectId[];
    const students = studentIds.length
      ? await Student.find({ _id: { $in: studentIds } })
          .select("_id firstName lastName admissionNo")
          .lean<EscalationStudentLite[]>()
      : [];
    const studentMap = new Map(
      students.map((student) => [
        String(student._id),
        {
          name: `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo || undefined,
        },
      ])
    );

    return Response.json({
      success: true,
      data: {
        escalations: escalations.map((esc) => ({
          id: String(esc._id),
          type: esc.type,
          title: esc.title,
          description: esc.description,
          status: esc.status,
          student: esc.studentId
            ? {
                id: String(esc.studentId),
                ...studentMap.get(String(esc.studentId)),
              }
            : null,
          createdAt: esc.createdAt ? esc.createdAt.toISOString() : null,
          resolvedAt: esc.resolvedAt ? esc.resolvedAt.toISOString() : null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch escalations:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch escalations";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.escalationsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = EscalationCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const studentObjId = toObjectIdOrNull(parsed.data.studentId);

    if (studentObjId && !context.isAdmin) {
      const student = await Student.findOne({
        _id: studentObjId,
        schoolId: context.schoolId,
        status: "active",
      })
        .select("classGroupId")
        .lean();

      if (!student) {
        return Response.json({ success: false, error: "Student not found" }, { status: 404 });
      }

      const isHomeroom = context.homeroomClassGroupId
        ? String(context.homeroomClassGroupId) === String(student.classGroupId)
        : false;

      if (!isHomeroom) {
        const period = await AcademicPeriod.findOne({
          schoolId: context.schoolId,
          isCurrent: true,
        })
          .select("_id")
          .lean();

        if (!period) {
          return Response.json(
            { success: false, error: "No active academic period" },
            { status: 400 }
          );
        }

        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: student.classGroupId,
          academicPeriodId: period._id,
          status: "active",
        })
          .select("_id")
          .lean();

        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const escalation = await Escalation.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      studentId: studentObjId || undefined,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      status: "open",
    });

    return Response.json({ success: true, data: { escalationId: String(escalation._id) } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create escalation:", e);
    const message = e instanceof Error ? e.message : "Failed to create escalation";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
