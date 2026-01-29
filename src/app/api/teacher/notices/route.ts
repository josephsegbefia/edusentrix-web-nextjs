import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Notice } from "@/models/Notice";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const AttachmentSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().min(0).optional(),
});

const NoticeCreateSchema = z.object({
  title: z.string().min(1).max(160),
  message: z.string().min(1),
  audience: z.enum(["class", "subject", "school", "custom"]),
  classGroupIds: z.array(z.string().min(1)).optional(),
  subjectIds: z.array(z.string().min(1)).optional(),
  targetStudentIds: z.array(z.string().min(1)).optional(),
  scheduledFor: z.string().optional().nullable(),
  attachments: z.array(AttachmentSchema).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateInput(value?: string | null) {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 8, 0, 0, 0);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function ensureNoticeScope(params: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  isAdmin: boolean;
  audience: "class" | "subject" | "school" | "custom";
  classGroupIds: mongoose.Types.ObjectId[];
  subjectIds: mongoose.Types.ObjectId[];
  targetStudentIds: mongoose.Types.ObjectId[];
}) {
  const { schoolId, teacherId, isAdmin, audience, classGroupIds, subjectIds, targetStudentIds } = params;
  if (isAdmin) return;

  if (audience === "school") {
    throw Response.json({ success: false, error: "School-wide notices are restricted" }, { status: 403 });
  }

  const period = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
    .select("_id")
    .lean();

  if (!period) {
    throw Response.json({ success: false, error: "No active academic period" }, { status: 400 });
  }

  const assignments = await TeacherAssignment.find({
    schoolId,
    teacherId,
    academicPeriodId: period._id,
    status: "active",
  })
    .select("classGroupId subjectId")
    .lean();

  const allowedClassGroups = new Set(assignments.map((a) => String(a.classGroupId)));
  const allowedSubjects = new Set(assignments.map((a) => String(a.subjectId)));

  if (classGroupIds.length > 0) {
    const missing = classGroupIds.filter((id) => !allowedClassGroups.has(String(id)));
    if (missing.length > 0) {
      throw Response.json({ success: false, error: "Invalid class group scope" }, { status: 403 });
    }
  }

  if (subjectIds.length > 0) {
    const missing = subjectIds.filter((id) => !allowedSubjects.has(String(id)));
    if (missing.length > 0) {
      throw Response.json({ success: false, error: "Invalid subject scope" }, { status: 403 });
    }
  }

  if (targetStudentIds.length > 0) {
    const students = await Student.find({
      _id: { $in: targetStudentIds },
      schoolId,
      status: "active",
    })
      .select("classGroupId")
      .lean();

    if (students.length !== targetStudentIds.length) {
      throw Response.json({ success: false, error: "One or more students are invalid" }, { status: 400 });
    }

    const invalid = students.filter((student) => !allowedClassGroups.has(String(student.classGroupId)));
    if (invalid.length > 0) {
      throw Response.json({ success: false, error: "Student outside assigned classes" }, { status: 403 });
    }
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const audience = searchParams.get("audience");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (status) query.status = status;
    if (audience) query.audience = audience;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const notices = await Notice.find(query)
      .sort({ createdAt: -1 })
      .select("title message status audience classGroupIds subjectIds targetStudentIds scheduledFor publishedAt createdAt")
      .lean();

    return Response.json({
      success: true,
      data: {
        notices: notices.map((notice) => ({
          id: String(notice._id),
          title: notice.title,
          message: notice.message,
          status: notice.status,
          audience: notice.audience,
          counts: {
            classGroups: notice.classGroupIds?.length || 0,
            subjects: notice.subjectIds?.length || 0,
            students: notice.targetStudentIds?.length || 0,
          },
          scheduledFor: notice.scheduledFor ? notice.scheduledFor.toISOString() : null,
          publishedAt: notice.publishedAt ? notice.publishedAt.toISOString() : null,
          createdAt: notice.createdAt ? notice.createdAt.toISOString() : null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch notices:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch notices";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesPublish)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = NoticeCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const scheduledFor = parseDateInput(parsed.data.scheduledFor);
    if (parsed.data.scheduledFor && !scheduledFor) {
      return Response.json({ success: false, error: "Invalid scheduled date" }, { status: 400 });
    }

    const classGroupIds = (parsed.data.classGroupIds || [])
      .map(toObjectIdOrNull)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const subjectIds = (parsed.data.subjectIds || [])
      .map(toObjectIdOrNull)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const targetStudentIds = (parsed.data.targetStudentIds || [])
      .map(toObjectIdOrNull)
      .filter(Boolean) as mongoose.Types.ObjectId[];

    if (parsed.data.audience === "class" && classGroupIds.length === 0) {
      return Response.json({ success: false, error: "Class group is required" }, { status: 400 });
    }
    if (parsed.data.audience === "subject" && subjectIds.length === 0) {
      return Response.json({ success: false, error: "Subject selection is required" }, { status: 400 });
    }
    if (parsed.data.audience === "custom" && targetStudentIds.length === 0) {
      return Response.json({ success: false, error: "Select at least one student" }, { status: 400 });
    }

    await ensureNoticeScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
      audience: parsed.data.audience,
      classGroupIds,
      subjectIds,
      targetStudentIds,
    });

    const status = scheduledFor && scheduledFor.getTime() > Date.now() ? "scheduled" : "draft";

    const notice = await Notice.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      title: parsed.data.title,
      message: parsed.data.message,
      audience: parsed.data.audience,
      classGroupIds,
      subjectIds,
      targetStudentIds,
      attachments: parsed.data.attachments || [],
      status,
      scheduledFor: scheduledFor || undefined,
    });

    return Response.json({
      success: true,
      data: {
        noticeId: String(notice._id),
        status: notice.status,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create notice:", e);
    const message = e instanceof Error ? e.message : "Failed to create notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
