import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { JournalEntry } from "@/models/JournalEntry";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";

const JournalEntrySchema = z.object({
  classGroupId: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  title: z.string().max(200).optional().nullable(),
  content: z.string().min(1).max(8000),
  status: z.enum(["draft", "published"]).default("draft"),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().min(1),
        type: z.string().min(1),
        size: z.number().min(0).optional().nullable(),
      })
    )
    .optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function toDateRange(startDate?: string | null, endDate?: string | null) {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
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

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (classGroupObjId) query.classGroupId = classGroupObjId;
    if (subjectObjId) query.subjectId = subjectObjId;
    if (status) query.status = status;

    const dateRange = toDateRange(startDate, endDate);
    if (dateRange) query.date = dateRange;

    const entries = await JournalEntry.find(query)
      .sort({ date: -1, createdAt: -1 })
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
      date: entry.date ? new Date(entry.date).toISOString() : null,
      title: entry.title || null,
      content: entry.content,
      status: entry.status,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    }));

    return Response.json({ success: true, data: { entries: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch journal entries:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch journal entries";
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
    const parsed = JournalEntrySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { classGroupId, subjectId, date, title, content, status, attachments } = parsed.data;

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

    const entryDate = new Date(date);
    if (Number.isNaN(entryDate.getTime())) {
      return Response.json({ success: false, error: "Invalid date" }, { status: 400 });
    }

    const created = await JournalEntry.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      classGroupId: classGroupObjId,
      subjectId: subjectObjId || undefined,
      date: entryDate,
      title: title || undefined,
      content,
      status,
      attachments: attachments || [],
    });

    return Response.json({
      success: true,
      data: {
        id: String(created._id),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create journal entry:", e);
    const message = e instanceof Error ? e.message : "Failed to create journal entry";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
