import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { formatTeachingModeDto } from "@/lib/lessons/lesson-format";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";
import { Student } from "@/models/Student";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { completionRatioPercent } from "@/lib/lessons/completion-percent";
import { resolveLessonNoteSchemeFields } from "@/lib/lesson-notes/validate-lesson-note-scheme";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";

const CreateLessonBodySchema = z.object({
  lessonNoteId: z.string().min(1),
  title: z.string().trim().min(1).max(220).optional(),
  scheduledAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatLessonRow(
  lesson: ILesson,
  noteTopicById: Map<string, string>
): Record<string, unknown> {
  return {
    id: String(lesson._id),
    schoolId: String(lesson.schoolId),
    teacherId: String(lesson.teacherId),
    lessonNoteId: String(lesson.lessonNoteId),
    lessonNoteTopic: noteTopicById.get(String(lesson.lessonNoteId)) ?? null,
    classGroupId: String(lesson.classGroupId),
    subjectOfferingId: lesson.subjectOfferingId ? String(lesson.subjectOfferingId) : null,
    subjectId: lesson.subjectId ? String(lesson.subjectId) : null,
    academicPeriodId: lesson.academicPeriodId ? String(lesson.academicPeriodId) : null,
    title: lesson.title,
    scheduledAt: lesson.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : null,
    status: lesson.status,
    publishedAt: lesson.publishedAt ? new Date(lesson.publishedAt).toISOString() : null,
    publishedSnapshot: lesson.publishedSnapshot ?? null,
    teachingMode: formatTeachingModeDto(lesson),
    createdAt: lesson.createdAt ? new Date(lesson.createdAt).toISOString() : null,
    updatedAt: lesson.updatedAt ? new Date(lesson.updatedAt).toISOString() : null,
  };
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const lessonNoteId = searchParams.get("lessonNoteId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 50;

    const activeAssignments = await TeacherAssignment.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      status: "active",
    })
      .select("classGroupId subjectId subjectOfferingId academicPeriodId")
      .lean();

    const assignmentDerivedVisibility = Array.from(
      new Map(
        activeAssignments.map((assignment) => {
          const query: Record<string, unknown> = { classGroupId: assignment.classGroupId };
          if (assignment.subjectOfferingId) query.subjectOfferingId = assignment.subjectOfferingId;
          else if (assignment.subjectId) query.subjectId = assignment.subjectId;
          if (assignment.academicPeriodId) query.academicPeriodId = assignment.academicPeriodId;
          return [JSON.stringify(query), query];
        })
      ).values()
    );

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      $or: [
        { teacherId: context.teacherId },
        { collaboratorTeacherIds: { $in: [context.teacherId] } },
        ...assignmentDerivedVisibility,
      ],
    };

    if (lessonNoteId) {
      const noteObjId = toObjectIdOrNull(lessonNoteId);
      if (!noteObjId) {
        return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
      }
      query.lessonNoteId = noteObjId;
    }

    const entries = (await Lesson.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean()) as ILesson[];

    const noteIds = [...new Set(entries.map((e) => String(e.lessonNoteId)))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const notes = noteIds.length
      ? ((await LessonNote.find({ _id: { $in: noteIds } })
          .select("_id topic")
          .lean()) as Pick<ILessonNote, "_id" | "topic">[])
      : [];

    const noteTopicById = new Map(notes.map((n) => [String(n._id), n.topic]));

    const lessonIdsNonDraft = entries
      .filter((e) => e.status !== "draft")
      .map((e) => e._id);

    const classOids = [...new Set(entries.map((e) => String(e.classGroupId)))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const [studiedAgg, classSizes] = await Promise.all([
      lessonIdsNonDraft.length > 0
        ? StudentLessonProgress.aggregate<{ _id: mongoose.Types.ObjectId; studiedCount: number }>([
            {
              $match: {
                schoolId: context.schoolId,
                lessonId: { $in: lessonIdsNonDraft },
                completionStatus: "completed",
              },
            },
            { $group: { _id: "$lessonId", studiedCount: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      classOids.length > 0
        ? Student.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
            {
              $match: {
                schoolId: context.schoolId,
                status: "active",
                classGroupId: { $in: classOids },
              },
            },
            { $group: { _id: "$classGroupId", n: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
    ]);

    const studiedMap = new Map(studiedAgg.map((r) => [String(r._id), r.studiedCount]));
    const sizeMap = new Map(classSizes.map((c) => [String(c._id), c.n]));

    const data = entries.map((entry) => {
      const row = formatLessonRow(entry, noteTopicById);
      if (entry.status === "draft") {
        return { ...row, studentStudiedSummary: null };
      }
      const studiedCount = studiedMap.get(String(entry._id)) ?? 0;
      const classActiveStudentsTotal = sizeMap.get(String(entry.classGroupId)) ?? 0;
      const studiedPercent = completionRatioPercent(studiedCount, classActiveStudentsTotal);
      return {
        ...row,
        studentStudiedSummary: { studiedCount, classActiveStudentsTotal, studiedPercent },
      };
    });

    return Response.json({ success: true, data: { entries: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to list lessons:", e);
    const message = e instanceof Error ? e.message : "Failed to list lessons";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = CreateLessonBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg =
        parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const noteId = toObjectIdOrNull(parsed.data.lessonNoteId);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const note = (await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select(
        "_id classGroupId subjectId subjectOfferingId academicPeriodId topic schemeId schemeItemIds status"
      )
      .lean()) as Pick<
      ILessonNote,
      | "_id"
      | "classGroupId"
      | "subjectId"
      | "subjectOfferingId"
      | "academicPeriodId"
      | "topic"
      | "schemeId"
      | "schemeItemIds"
      | "status"
    > | null;

    if (!note) {
      return Response.json(
        { success: false, error: "Lesson note not found" },
        { status: 404 }
      );
    }

    if (note.status !== "approved" && note.status !== "published") {
      return Response.json(
        {
          success: false,
          error:
            "Only approved lesson notes can be used to create lessons. Submit your note for school review first.",
        },
        { status: 403 },
      );
    }

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: note.classGroupId,
        status: "active",
      };
      if (note.subjectOfferingId) assignmentQuery.subjectOfferingId = note.subjectOfferingId;
      else if (note.subjectId) assignmentQuery.subjectId = note.subjectId;

      const assignment = await TeacherAssignment.findOne(assignmentQuery).select("_id").lean();
      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    let scheduledAt: Date | undefined;
    if (parsed.data.scheduledAt) {
      scheduledAt = new Date(parsed.data.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        return Response.json({ success: false, error: "Invalid scheduled date" }, { status: 400 });
      }
    }

    const title = parsed.data.title?.trim() || note.topic;

    let schemeOid: mongoose.Types.ObjectId | undefined;
    let schemeItemOids: mongoose.Types.ObjectId[] | undefined;
    if (note.schemeId) {
      const resolved = await resolveLessonNoteSchemeFields({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: note.classGroupId,
        subjectId: note.subjectId,
        schemeId: String(note.schemeId),
        schemeItemIds: note.schemeItemIds?.map((id) => String(id)) ?? [],
      });
      if (resolved.ok && resolved.schemeObjectId) {
        schemeOid = resolved.schemeObjectId;
        if (resolved.schemeItemObjectIds.length > 0) {
          schemeItemOids = resolved.schemeItemObjectIds;
        }
      }
    }

    const created = await Lesson.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      lessonNoteId: note._id,
      classGroupId: note.classGroupId,
      subjectOfferingId: note.subjectOfferingId || undefined,
      subjectId: note.subjectId || undefined,
      academicPeriodId: note.academicPeriodId || undefined,
      title,
      scheduledAt,
      status: "draft",
      ...(schemeOid ? { schemeId: schemeOid } : {}),
      ...(schemeItemOids ? { schemeItemIds: schemeItemOids } : {}),
    });

    void recordLessonAudit({
      schoolId: context.schoolId,
      lessonId: created._id,
      actorId: context.userId,
      action: "lesson_created_from_note",
      metadata: { lessonNoteId: String(note._id) },
      httpRequest: req,
      actorRole: context.isAdmin ? "school_admin" : "teacher",
    });

    return Response.json({
      success: true,
      data: { id: String(created._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson:", e);
    const message = e instanceof Error ? e.message : "Failed to create lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
