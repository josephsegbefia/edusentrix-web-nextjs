import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { LessonNote } from "@/models/LessonNote";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 80) : 40;
    const subjectIdParam = searchParams.get("subjectId");
    const classGroupIdParam = searchParams.get("classGroupId");

    const match: Record<string, unknown> = {
      schoolId: context.schoolId,
      status: { $in: ["published", "archived"] as const },
    };

    if (subjectIdParam) {
      const sid = toObjectIdOrNull(subjectIdParam);
      if (!sid) {
        return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
      }
      match.subjectId = sid;
    }

    if (classGroupIdParam) {
      const cid = toObjectIdOrNull(classGroupIdParam);
      if (!cid) {
        return Response.json({ success: false, error: "Invalid classGroupId" }, { status: 400 });
      }
      match.classGroupId = cid;
    }

    if (q.length > 0) {
      match.title = new RegExp(escapeRegExp(q), "i");
    }

    const entries = (await Lesson.find(match)
      .sort({ publishedAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean()) as ILesson[];

    const noteIds = [...new Set(entries.map((e) => e.lessonNoteId))];
    const classIds = [...new Set(entries.map((e) => e.classGroupId))];
    const subjectIds = [...new Set(entries.map((e) => e.subjectId).filter(Boolean))] as mongoose.Types.ObjectId[];
    const teacherIds = [...new Set(entries.map((e) => e.teacherId))];

    const [notes, classes, subjects, teachers] = await Promise.all([
      noteIds.length
        ? LessonNote.find({ _id: { $in: noteIds } })
            .select("_id topic")
            .lean()
        : [],
      classIds.length
        ? ClassGroup.find({ _id: { $in: classIds } })
            .select("_id name gradeId")
            .lean()
        : [],
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } })
            .select("_id name")
            .lean()
        : [],
      teacherIds.length
        ? Teacher.find({ _id: { $in: teacherIds } })
            .select("_id userId")
            .lean()
        : [],
    ]);

    const noteTopicById = new Map(
      (notes as { _id: mongoose.Types.ObjectId; topic: string }[]).map((n) => [String(n._id), n.topic])
    );

    const gradeIds = [
      ...new Set(
        (classes as { gradeId?: mongoose.Types.ObjectId }[])
          .map((c) => c.gradeId)
          .filter(Boolean)
      ),
    ] as mongoose.Types.ObjectId[];

    const grades = gradeIds.length
      ? ((await Grade.find({ _id: { $in: gradeIds } })
          .select("_id name")
          .lean()) as { _id: mongoose.Types.ObjectId; name: string }[])
      : [];
    const gradeNameById = new Map(grades.map((g) => [String(g._id), g.name]));

    const classLabelById = new Map<string, string>();
    for (const c of classes as {
      _id: mongoose.Types.ObjectId;
      name: string;
      gradeId?: mongoose.Types.ObjectId;
    }[]) {
      let label = c.name || "Class";
      if (c.gradeId) {
        const gn = gradeNameById.get(String(c.gradeId));
        if (gn) label = `${gn} ${label}`.trim();
      }
      classLabelById.set(String(c._id), label);
    }

    const subjectNameById = new Map(
      (subjects as { _id: mongoose.Types.ObjectId; name: string }[]).map((s) => [
        String(s._id),
        s.name,
      ])
    );

    const userIds = [...new Set((teachers as { userId?: mongoose.Types.ObjectId }[]).map((t) => t.userId).filter(Boolean))] as mongoose.Types.ObjectId[];
    const users = userIds.length
      ? ((await User.find({ _id: { $in: userIds } })
          .select("_id name firstName lastName")
          .lean()) as {
          _id: mongoose.Types.ObjectId;
          name?: string;
          firstName?: string;
          lastName?: string;
        }[])
      : [];

    function displayName(u: {
      name?: string;
      firstName?: string;
      lastName?: string;
    }): string | null {
      if (u.name?.trim()) return u.name.trim();
      const fn = u.firstName?.trim() || "";
      const ln = u.lastName?.trim() || "";
      const full = `${fn} ${ln}`.trim();
      return full || null;
    }

    const userNameById = new Map(users.map((u) => [String(u._id), displayName(u)]));

    const teacherUserById = new Map(
      (teachers as { _id: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId }[]).map(
        (t) => [String(t._id), t.userId ? String(t.userId) : null]
      )
    );

    const data = entries.map((e) => {
      const uid = teacherUserById.get(String(e.teacherId));
      const ownerDisplayName = uid ? userNameById.get(uid) ?? null : null;
      return {
        id: String(e._id),
        title: e.title,
        status: e.status,
        publishedAt: e.publishedAt ? new Date(e.publishedAt).toISOString() : null,
        scheduledAt: e.scheduledAt ? new Date(e.scheduledAt).toISOString() : null,
        classGroupId: String(e.classGroupId),
        classDisplayLabel: classLabelById.get(String(e.classGroupId)) ?? null,
        subjectId: e.subjectId ? String(e.subjectId) : null,
        subjectName: e.subjectId ? subjectNameById.get(String(e.subjectId)) ?? null : null,
        lessonNoteId: String(e.lessonNoteId),
        lessonNoteTopic: noteTopicById.get(String(e.lessonNoteId)) ?? null,
        schemeId: e.schemeId ? String(e.schemeId) : null,
        schemeItemIds: (e.schemeItemIds || []).map((id) => String(id)),
        ownerTeacherId: String(e.teacherId),
        ownerDisplayName,
      };
    });

    return Response.json({ success: true, data: { entries: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to list lesson bank:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
