import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
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

const HomeworkUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  instructions: z.string().min(1).optional(),
  type: z.enum(["assignment", "quiz", "project", "practice"]).optional(),
  subjectId: z.string().min(1).optional(),
  classGroupIds: z.array(z.string().min(1)).optional(),
  targetStudentIds: z.array(z.string().min(1)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  latePolicy: z.enum(["accept", "reject", "penalize"]).optional(),
  latePenaltyPercent: z.number().min(0).max(100).optional().nullable(),
  maxScore: z.number().min(0).optional(),
  weight: z.number().min(0).max(100).optional().nullable(),
  rubricId: z.string().optional().nullable(),
  attachments: z.array(AttachmentSchema).optional(),
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

async function hydrateAssignment(item: any) {
  const classGroups = item.classGroupIds || [];
  const gradeIds = Array.from(
    new Set(classGroups.map((group: any) => String(group.gradeId)))
  ).filter(Boolean);
  const grades = gradeIds.length
    ? await Grade.find({ _id: { $in: gradeIds } }).select("name").lean()
    : [];
  const gradeMap = new Map(
    grades.map((grade: any) => [String(grade._id), grade.name])
  );

  const stats = await Submission.aggregate([
    { $match: { homeworkId: item._id } },
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
            $cond: [{ $in: ["$status", ["submitted", "late"]] }, 1, 0],
          },
        },
        returned: {
          $sum: {
            $cond: [{ $eq: ["$status", "returned"] }, 1, 0],
          },
        },
      },
    },
  ]);

  const counts = stats[0] || {
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
    classGroups: classGroups.map((group: any) => {
      const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : null;
      const name = gradeName ? `${gradeName} ${group.name}` : group.name;
      return {
        id: String(group._id),
        name,
        gradeName: gradeName || undefined,
      };
    }),
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
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);

    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const query: Record<string, unknown> = {
      _id: homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    const assignment = await Homework.findOne(query)
      .populate("classGroupIds", "name gradeId")
      .populate("subjectId", "name")
      .populate("rubricId", "title")
      .lean();

    if (!assignment) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const hydrated = await hydrateAssignment(assignment);

    return Response.json({ success: true, data: { assignment: hydrated } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to load assignment";
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
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);

    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = HomeworkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const current = await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("subjectId classGroupIds")
      .lean();

    if (!current) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const update = parsed.data;

    const subjectObjId = update.subjectId
      ? toObjectIdOrNull(update.subjectId)
      : (current.subjectId as mongoose.Types.ObjectId);
    const classGroupIds = update.classGroupIds
      ? update.classGroupIds
          .map((id) => toObjectIdOrNull(id))
          .filter(Boolean)
      : (current.classGroupIds as mongoose.Types.ObjectId[]);

    if (!subjectObjId || classGroupIds.length === 0) {
      return Response.json(
        { success: false, error: "Invalid subject or class group" },
        { status: 400 }
      );
    }

    if (update.subjectId) {
      const subject = await Subject.findOne({
        _id: subjectObjId,
        schoolId: context.schoolId,
      })
        .select("_id")
        .lean();
      if (!subject) {
        return Response.json({ success: false, error: "Subject not found" }, { status: 404 });
      }
    }

    if (update.classGroupIds) {
      const classGroups = await ClassGroup.find({
        _id: { $in: classGroupIds },
        schoolId: context.schoolId,
      })
        .select("_id")
        .lean();
      if (classGroups.length !== classGroupIds.length) {
        return Response.json(
          { success: false, error: "Some class groups were not found" },
          { status: 404 }
        );
      }
    }

    await ensureTeacherScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      subjectId: subjectObjId,
      classGroupIds,
      isAdmin: context.isAdmin,
    });

    const patch: Record<string, unknown> = {};

    if (update.title) patch.title = update.title;
    if (update.instructions) patch.instructions = update.instructions;
    if (update.type) patch.type = update.type;
    if (update.subjectId) patch.subjectId = subjectObjId;
    if (update.classGroupIds) patch.classGroupIds = classGroupIds;
    if (update.targetStudentIds) {
      patch.targetStudentIds = update.targetStudentIds
        .map((id) => toObjectIdOrNull(id))
        .filter(Boolean);
    }
    if (update.dueDate) {
      const dueDate = parseDateInput(update.dueDate);
      if (!dueDate) {
        return Response.json({ success: false, error: "Invalid due date" }, { status: 400 });
      }
      patch.dueDate = dueDate;
    }
    if (update.latePolicy) patch.latePolicy = update.latePolicy;
    if (update.latePenaltyPercent !== undefined) {
      patch.latePenaltyPercent = update.latePenaltyPercent ?? undefined;
    }
    if (update.maxScore !== undefined) patch.maxScore = update.maxScore;
    if (update.weight !== undefined) patch.weight = update.weight ?? undefined;
    if (update.rubricId !== undefined) {
      if (update.rubricId) {
        const rubricId = toObjectIdOrNull(update.rubricId);
        if (!rubricId) {
          return Response.json({ success: false, error: "Invalid rubric" }, { status: 400 });
        }
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
        patch.rubricId = rubricId;
      } else {
        patch.rubricId = undefined;
      }
    }
    if (update.attachments) patch.attachments = update.attachments;

    await Homework.updateOne({ _id: homeworkId }, { $set: patch });

    const refreshed = await Homework.findById(homeworkId)
      .populate("classGroupIds", "name gradeId")
      .populate("subjectId", "name")
      .populate("rubricId", "title")
      .lean();

    if (!refreshed) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    const hydrated = await hydrateAssignment(refreshed);

    return Response.json({ success: true, data: { assignment: hydrated } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to update assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsCreate);

    const { id } = await ctx.params;
    const homeworkId = toObjectIdOrNull(id);

    if (!homeworkId) {
      return Response.json({ success: false, error: "Invalid assignment ID" }, { status: 400 });
    }

    const homework = await Homework.findOne({
      _id: homeworkId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id status")
      .lean();

    if (!homework) {
      return Response.json({ success: false, error: "Assignment not found" }, { status: 404 });
    }

    await Homework.updateOne(
      { _id: homeworkId },
      { $set: { status: "archived", closedAt: new Date() } }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to delete assignment";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
