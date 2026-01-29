import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Homework } from "@/models/Homework";
import { Rubric } from "@/models/Rubric";
import { Subject } from "@/models/Subject";
import { Submission } from "@/models/Submission";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";

const AttachmentSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  type: z.enum(["pdf", "image", "video", "audio", "link"]),
  size: z.number().min(0).optional(),
});

const HomeworkCreateSchema = z.object({
  title: z.string().min(1).max(160),
  instructions: z.string().min(1),
  type: z.enum(["assignment", "quiz", "project", "practice"]),
  subjectId: z.string().min(1),
  classGroupIds: z.array(z.string().min(1)).min(1),
  targetStudentIds: z.array(z.string().min(1)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  latePolicy: z.enum(["accept", "reject", "penalize"]).optional(),
  latePenaltyPercent: z.number().min(0).max(100).optional().nullable(),
  maxScore: z.number().min(0),
  weight: z.number().min(0).max(100).optional().nullable(),
  rubricId: z.string().optional().nullable(),
  attachments: z.array(AttachmentSchema).optional(),
  status: z.enum(["draft", "published"]).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateInput(value: string): Date | null {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (dateOnly) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

async function ensureTeacherScope(params: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classGroupIds: mongoose.Types.ObjectId[];
  isAdmin: boolean;
}) {
  if (params.isAdmin) return;
  const { schoolId, teacherId, subjectId, classGroupIds } = params;
  const assignments = await TeacherAssignment.find({
    schoolId,
    teacherId,
    subjectId,
    classGroupId: { $in: classGroupIds },
    status: "active",
  })
    .select("classGroupId")
    .lean();

  const allowed = new Set(assignments.map((a) => String(a.classGroupId)));
  const missing = classGroupIds.filter((id) => !allowed.has(String(id)));
  if (missing.length > 0) {
    throw Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
}

async function hydrateAssignments(list: any[]) {
  const classGroups = list.flatMap((item) => item.classGroupIds || []);
  const gradeIds = Array.from(
    new Set(classGroups.map((group: any) => String(group.gradeId)))
  ).filter(Boolean);

  const grades = gradeIds.length
    ? await Grade.find({ _id: { $in: gradeIds } }).select("name").lean()
    : [];
  const gradeMap = new Map(
    grades.map((grade: any) => [String(grade._id), grade.name])
  );

  const homeworkIds = list.map((item) => item._id);
  const stats = homeworkIds.length
    ? await Submission.aggregate([
        { $match: { homeworkId: { $in: homeworkIds } } },
        {
          $group: {
            _id: "$homeworkId",
            total: { $sum: 1 },
            graded: {
              $sum: {
                $cond: [{ $eq: ["$status", "graded"] }, 1, 0],
              },
            },
            pending: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["submitted", "late"]] },
                  1,
                  0,
                ],
              },
            },
            returned: {
              $sum: {
                $cond: [{ $eq: ["$status", "returned"] }, 1, 0],
              },
            },
          },
        },
      ])
    : [];

  const statMap = new Map(stats.map((row: any) => [String(row._id), row]));

  return list.map((item) => {
    const classLabels = (item.classGroupIds || []).map((group: any) => {
      const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : null;
      const name = gradeName ? `${gradeName} ${group.name}` : group.name;
      return {
        id: String(group._id),
        name,
        gradeName: gradeName || undefined,
      };
    });

    const counts = statMap.get(String(item._id)) || {
      total: item.submissionCount || 0,
      graded: item.gradedCount || 0,
      pending: 0,
      returned: 0,
    };

    return {
      id: String(item._id),
      title: item.title,
      instructions: item.instructions,
      type: item.type,
      status: item.status,
      dueDate: item.dueDate?.toISOString(),
      latePolicy: item.latePolicy,
      latePenaltyPercent: item.latePenaltyPercent ?? null,
      maxScore: item.maxScore,
      weight: item.weight ?? null,
      subject: item.subjectId
        ? { id: String(item.subjectId._id || item.subjectId), name: item.subjectId.name }
        : null,
      rubric: item.rubricId
        ? { id: String(item.rubricId._id || item.rubricId), title: item.rubricId.title }
        : null,
      classGroups: classLabels,
      targetStudentIds: (item.targetStudentIds || []).map((id: any) => String(id)),
      attachments: item.attachments || [],
      stats: {
        total: counts.total || 0,
        graded: counts.graded || 0,
        pending: counts.pending || 0,
        returned: counts.returned || 0,
      },
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
      closedAt: item.closedAt ? item.closedAt.toISOString() : null,
      createdAt: item.createdAt ? item.createdAt.toISOString() : null,
    };
  });
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const classGroupId = searchParams.get("classGroupId");
    const subjectId = searchParams.get("subjectId");
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (status && ["draft", "published", "closed", "archived"].includes(status)) {
      query.status = status;
    }
    if (type && ["assignment", "quiz", "project", "practice"].includes(type)) {
      query.type = type;
    }
    if (classGroupId) {
      const classObj = toObjectIdOrNull(classGroupId);
      if (classObj) query.classGroupIds = classObj;
    }
    if (subjectId) {
      const subjectObj = toObjectIdOrNull(subjectId);
      if (subjectObj) query.subjectId = subjectObj;
    }
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const assignments = await Homework.find(query)
      .sort({ createdAt: -1 })
      .populate("classGroupIds", "name gradeId")
      .populate("subjectId", "name")
      .populate("rubricId", "title")
      .lean();

    const hydrated = await hydrateAssignments(assignments);

    return Response.json({ success: true, data: { assignments: hydrated } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load assignments:", e);
    const message = e instanceof Error ? e.message : "Failed to load assignments";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const body = await req.json().catch(() => null);
    const parsed = HomeworkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const subjectObjId = toObjectIdOrNull(data.subjectId);
    const classGroupIds = data.classGroupIds
      .map((id) => toObjectIdOrNull(id))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    if (!subjectObjId || classGroupIds.length === 0) {
      return Response.json(
        { success: false, error: "Invalid subject or class group" },
        { status: 400 }
      );
    }

    const [subject, classGroups, period] = await Promise.all([
      Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
        .select("_id")
        .lean(),
      ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: context.schoolId })
        .select("_id")
        .lean(),
      AcademicPeriod.findOne({ schoolId: context.schoolId, isCurrent: true })
        .select("_id")
        .lean(),
    ]);

    if (!subject) {
      return Response.json(
        { success: false, error: "Subject not found" },
        { status: 404 }
      );
    }
    if (classGroups.length !== classGroupIds.length) {
      return Response.json(
        { success: false, error: "Some class groups were not found" },
        { status: 404 }
      );
    }
    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    await ensureTeacherScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      subjectId: subjectObjId,
      classGroupIds,
      isAdmin: context.isAdmin,
    });

    const dueDate = parseDateInput(data.dueDate);
    if (!dueDate) {
      return Response.json({ success: false, error: "Invalid due date" }, { status: 400 });
    }

    const rubricId = data.rubricId ? toObjectIdOrNull(data.rubricId) : null;
    if (data.rubricId && !rubricId) {
      return Response.json({ success: false, error: "Invalid rubric" }, { status: 400 });
    }
    if (rubricId) {
      const rubric = await Rubric.findOne({
        _id: rubricId,
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      })
        .select("_id")
        .lean();
      if (!rubric) {
        return Response.json({ success: false, error: "Rubric not found" }, { status: 404 });
      }
    }

    const now = new Date();
    const status = data.status || "draft";

    const homework = await Homework.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId: period._id,
      subjectId: subjectObjId,
      classGroupIds,
      targetStudentIds: (data.targetStudentIds || [])
        .map((id) => toObjectIdOrNull(id))
        .filter(Boolean),
      title: data.title,
      instructions: data.instructions,
      type: data.type,
      dueDate,
      latePolicy: data.latePolicy || "accept",
      latePenaltyPercent: data.latePenaltyPercent ?? undefined,
      maxScore: data.maxScore,
      rubricId: rubricId || undefined,
      weight: data.weight ?? undefined,
      attachments: data.attachments || [],
      status,
      publishedAt: status === "published" ? now : undefined,
      submissionCount: 0,
      gradedCount: 0,
    });

    const hydrated = await Homework.findById(homework._id)
      .populate("classGroupIds", "name gradeId")
      .populate("subjectId", "name")
      .populate("rubricId", "title")
      .lean();

    const assignments = hydrated ? await hydrateAssignments([hydrated]) : [];

    return Response.json({ success: true, data: { assignment: assignments[0] } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to create assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
