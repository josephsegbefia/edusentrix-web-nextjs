import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const ResourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
  type: z.string().max(40).optional().nullable(),
});

const LessonNoteSchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  weekOf: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  topic: z.string().min(1).max(200),
  objectives: z.string().max(2000).optional().nullable(),
  content: z.string().min(1).max(8000),
  status: z.enum(["draft", "published"]).default("draft"),
  resources: z.array(ResourceSchema).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeWeekOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const subjectId = searchParams.get("subjectId");
    const status = searchParams.get("status");
    const weekOf = searchParams.get("weekOf");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(Number(limitParam), 1) : 50;

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
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
      }
      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          subjectId: subjectObjId,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    let academicPeriodObjId: mongoose.Types.ObjectId | null = null;
    if (academicPeriodId) {
      academicPeriodObjId = toObjectIdOrNull(academicPeriodId);
      if (!academicPeriodObjId) {
        return Response.json({ success: false, error: "Invalid academic period ID" }, { status: 400 });
      }
    }

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (classGroupObjId) query.classGroupId = classGroupObjId;
    if (subjectObjId) query.subjectId = subjectObjId;
    if (academicPeriodObjId) query.academicPeriodId = academicPeriodObjId;
    if (status) query.status = status;

    if (weekOf) {
      const weekDate = normalizeWeekOf(new Date(weekOf));
      if (Number.isNaN(weekDate.getTime())) {
        return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
      }
      query.weekOf = weekDate;
    }

    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }

    const entries = await LessonNote.find(query)
      .sort({ weekOf: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    if (entries.length === 0) {
      return Response.json({ success: true, data: { entries: [] } });
    }

    const classGroupIds = Array.from(
      new Set(entries.map((entry) => String(entry.classGroupId)))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const subjectIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.subjectId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const [classGroups, subjects] = await Promise.all([
      ClassGroup.find({ _id: { $in: classGroupIds } })
        .select("_id name gradeId")
        .lean(),
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean()
        : Promise.resolve([]),
    ]);

    const gradeIds = Array.from(
      new Set(
        classGroups
          .map((group: { gradeId?: mongoose.Types.ObjectId }) => group.gradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()
      : [];

    const gradeMap = new Map(
      grades.map((grade: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(grade._id),
        grade.name,
      ])
    );

    const classNameMap = new Map(
      classGroups.map(
        (group: { _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }) => {
          const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : undefined;
          const label = `${gradeName ? gradeName + " " : ""}${group.name}`.trim();
          return [String(group._id), label || group.name];
        }
      )
    );

    const subjectMap = new Map(
      subjects.map((subject: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(subject._id),
        subject.name,
      ])
    );

    const data = entries.map((entry) => ({
      id: String(entry._id),
      classGroupId: String(entry.classGroupId),
      className: classNameMap.get(String(entry.classGroupId)) || "",
      subjectId: entry.subjectId ? String(entry.subjectId) : null,
      subjectName: entry.subjectId ? subjectMap.get(String(entry.subjectId)) || "" : null,
      academicPeriodId: entry.academicPeriodId ? String(entry.academicPeriodId) : null,
      weekOf: entry.weekOf ? new Date(entry.weekOf).toISOString() : null,
      topic: entry.topic,
      objectives: entry.objectives || null,
      content: entry.content,
      status: entry.status,
      resources: entry.resources || [],
      tags: entry.tags || [],
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
    }));

    return Response.json({ success: true, data: { entries: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch lesson notes:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch lesson notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = LessonNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { classGroupId, subjectId, weekOf, topic, objectives, content, status, resources, tags } = parsed.data;

    const classGroupObjId = toObjectIdOrNull(classGroupId);
    if (!classGroupObjId) {
      return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
      }
    }

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (subjectObjId) assignmentQuery.subjectId = subjectObjId;

      const assignment = await TeacherAssignment.findOne(assignmentQuery)
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const weekDate = normalizeWeekOf(new Date(weekOf));
    if (Number.isNaN(weekDate.getTime())) {
      return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
    }

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    const created = await LessonNote.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      classGroupId: classGroupObjId,
      subjectId: subjectObjId || undefined,
      academicPeriodId: currentPeriod?._id || undefined,
      weekOf: weekDate,
      topic,
      objectives: objectives || undefined,
      content,
      status,
      resources: resources || [],
      tags: tags || [],
    });

    return Response.json({
      success: true,
      data: { id: String(created._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to create lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
