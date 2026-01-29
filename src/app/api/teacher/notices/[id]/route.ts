import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Notice } from "@/models/Notice";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const AttachmentSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  type: z.string().min(1),
  size: z.number().min(0).optional(),
});

const NoticeUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  message: z.string().min(1).optional(),
  audience: z.enum(["class", "subject", "school", "custom"]).optional(),
  classGroupIds: z.array(z.string().min(1)).optional(),
  subjectIds: z.array(z.string().min(1)).optional(),
  targetStudentIds: z.array(z.string().min(1)).optional(),
  scheduledFor: z.string().optional().nullable(),
  status: z.enum(["draft", "scheduled", "archived"]).optional(),
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const noticeId = toObjectIdOrNull(id);
    if (!noticeId) {
      return Response.json({ success: false, error: "Invalid notice id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: noticeId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const notice = await Notice.findOne(query).lean();
    if (!notice) {
      return Response.json({ success: false, error: "Notice not found" }, { status: 404 });
    }

    const classGroupIds = (notice.classGroupIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
    const subjectIds = (notice.subjectIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
    const studentIds = (notice.targetStudentIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));

    const [classGroups, subjects, students] = await Promise.all([
      classGroupIds.length
        ? ClassGroup.find({ _id: { $in: classGroupIds } }).select("_id name gradeId").lean()
        : Promise.resolve([]),
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean()
        : Promise.resolve([]),
      studentIds.length
        ? Student.find({ _id: { $in: studentIds } }).select("_id firstName lastName admissionNo gradeId classGroupId").lean()
        : Promise.resolve([]),
    ]);

    const gradeIds = Array.from(
      new Set(classGroups.map((group: any) => String(group.gradeId)))
    ).filter(Boolean);

    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()
      : [];
    const gradeMap = new Map(grades.map((grade: any) => [String(grade._id), grade.name]));

    return Response.json({
      success: true,
      data: {
        notice: {
          id: String(notice._id),
          title: notice.title,
          message: notice.message,
          audience: notice.audience,
          status: notice.status,
          scheduledFor: notice.scheduledFor ? notice.scheduledFor.toISOString() : null,
          publishedAt: notice.publishedAt ? notice.publishedAt.toISOString() : null,
          attachments: notice.attachments || [],
          classGroups: classGroups.map((group: any) => ({
            id: String(group._id),
            name: gradeMap.get(String(group.gradeId))
              ? `${gradeMap.get(String(group.gradeId))} ${group.name}`.trim()
              : group.name,
          })),
          subjects: subjects.map((subject: any) => ({
            id: String(subject._id),
            name: subject.name,
          })),
          students: students.map((student: any) => ({
            id: String(student._id),
            name: `${student.firstName} ${student.lastName}`.trim(),
            admissionNo: student.admissionNo || undefined,
          })),
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch notice:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesPublish)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const noticeId = toObjectIdOrNull(id);
    if (!noticeId) {
      return Response.json({ success: false, error: "Invalid notice id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: noticeId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const notice = await Notice.findOne(query).lean();
    if (!notice) {
      return Response.json({ success: false, error: "Notice not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = NoticeUpdateSchema.safeParse(body);
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

    const classGroupIds = (parsed.data.classGroupIds || notice.classGroupIds || [])
      .map((value: any) => toObjectIdOrNull(String(value)))
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const subjectIds = (parsed.data.subjectIds || notice.subjectIds || [])
      .map((value: any) => toObjectIdOrNull(String(value)))
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const targetStudentIds = (parsed.data.targetStudentIds || notice.targetStudentIds || [])
      .map((value: any) => toObjectIdOrNull(String(value)))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const audience = parsed.data.audience || notice.audience;

    if (audience === "class" && classGroupIds.length === 0) {
      return Response.json({ success: false, error: "Class group is required" }, { status: 400 });
    }
    if (audience === "subject" && subjectIds.length === 0) {
      return Response.json({ success: false, error: "Subject selection is required" }, { status: 400 });
    }
    if (audience === "custom" && targetStudentIds.length === 0) {
      return Response.json({ success: false, error: "Select at least one student" }, { status: 400 });
    }

    await ensureNoticeScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
      audience,
      classGroupIds,
      subjectIds,
      targetStudentIds,
    });

    const nextStatus = parsed.data.status || notice.status;

    const update: Record<string, unknown> = {
      title: parsed.data.title ?? notice.title,
      message: parsed.data.message ?? notice.message,
      audience,
      classGroupIds,
      subjectIds,
      targetStudentIds,
      attachments: parsed.data.attachments ?? notice.attachments ?? [],
      status: nextStatus,
    };

    if (nextStatus === "scheduled") {
      if (!scheduledFor) {
        return Response.json({ success: false, error: "Scheduled date required" }, { status: 400 });
      }
      update.scheduledFor = scheduledFor;
    }

    if (nextStatus === "draft") {
      update.scheduledFor = null;
    }

    await Notice.updateOne({ _id: noticeId }, { $set: update });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update notice:", e);
    const message = e instanceof Error ? e.message : "Failed to update notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.noticesPublish)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const noticeId = toObjectIdOrNull(id);
    if (!noticeId) {
      return Response.json({ success: false, error: "Invalid notice id" }, { status: 400 });
    }

    const query: Record<string, unknown> = { _id: noticeId, schoolId: context.schoolId };
    if (!context.isAdmin) query.teacherId = context.teacherId;

    const notice = await Notice.findOne(query).select("_id").lean();
    if (!notice) {
      return Response.json({ success: false, error: "Notice not found" }, { status: 404 });
    }

    await Notice.updateOne({ _id: noticeId }, { $set: { status: "archived" } });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to archive notice:", e);
    const message = e instanceof Error ? e.message : "Failed to archive notice";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
