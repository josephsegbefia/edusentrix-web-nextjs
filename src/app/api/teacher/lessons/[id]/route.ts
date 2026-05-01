import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson, type ILessonPublishedSnapshot } from "@/models/Lesson";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import {
  buildPublishedSnapshotFromLessonNote,
  lessonSnapshotToStudentDisplayNote,
} from "@/lib/lessons/published-snapshot";
import { formatTeachingModeDto } from "@/lib/lessons/lesson-format";
import { notifyStudentsOfPublishedLesson } from "@/lib/lessons/lesson-publish-notifications";
import { recordLessonAudit } from "@/lib/lessons/lesson-audit";
import { LessonFlashcard } from "@/models/LessonFlashcard";
import { Student } from "@/models/Student";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { completionRatioPercent } from "@/lib/lessons/completion-percent";
import { normalizeParentSummaryHtmlInput } from "@/lib/lessons/parent-summary-html";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Homework } from "@/models/Homework";
import { Teacher } from "@/models/Teacher";
import {
  canTeacherCollaborateOnLesson,
  resolveLessonCollaborators,
  validateCollaboratorTeacherIdsInput,
} from "@/lib/lessons/collaboration";

const teachingSegmentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  durationMinutes: z.number().int().min(0).max(600).optional().nullable(),
  teacherPrompt: z.string().trim().max(8000).optional().nullable(),
  learnerActivity: z.string().trim().max(8000).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
});

const PatchLessonBodySchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  scheduledAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional()
    .nullable(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  teachingMode: z
    .object({
      segments: z.array(teachingSegmentSchema).max(30),
    })
    .optional(),
  /** Caregiver-facing HTML draft; stored only on this lesson, shown to parents when school enables it. */
  parentSummaryHtml: z.union([z.string().max(48_000), z.null()]).optional(),
  collaboratorTeacherIds: z.array(z.string().min(1)).max(50).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeTeachingModePatch(
  body: NonNullable<z.infer<typeof PatchLessonBodySchema>["teachingMode"]>
) {
  return {
    segments: body.segments.map((s) => ({
      title: s.title.trim(),
      durationMinutes: s.durationMinutes ?? undefined,
      teacherPrompt: s.teacherPrompt?.trim() || undefined,
      learnerActivity: s.learnerActivity?.trim() || undefined,
      notes: s.notes?.trim() || undefined,
    })),
  };
}

async function resolveClassAndSubjectLabels(lesson: ILesson): Promise<{
  classDisplayLabel: string;
  subjectName: string | null;
}> {
  const [classGroup, subjectDoc] = await Promise.all([
    ClassGroup.findById(lesson.classGroupId).select("name gradeId").lean() as Promise<{
      name: string;
      gradeId?: mongoose.Types.ObjectId;
    } | null>,
    lesson.subjectId
      ? (Subject.findById(lesson.subjectId).select("name").lean() as Promise<{
          name: string;
        } | null>)
      : Promise.resolve(null),
  ]);

  let className = classGroup?.name || "Class";
  if (classGroup?.gradeId) {
    const grade = await Grade.findById(classGroup.gradeId).select("name").lean() as {
      name: string;
    } | null;
    if (grade?.name) {
      className = `${grade.name} ${className}`.trim();
    }
  }

  return {
    classDisplayLabel: className,
    subjectName: subjectDoc?.name ?? null,
  };
}

async function studentCompletionSnapshotForLesson(
  schoolId: mongoose.Types.ObjectId,
  lesson: Pick<ILesson, "_id" | "classGroupId" | "status">
): Promise<{
  classActiveStudentsTotal: number;
  studiedCount: number;
  studiedPercent: number | null;
} | null> {
  if (lesson.status === "draft") return null;

  const [classActiveStudentsTotal, studiedCount] = await Promise.all([
    Student.countDocuments({
      schoolId,
      classGroupId: lesson.classGroupId,
      status: "active",
    }),
    StudentLessonProgress.countDocuments({
      schoolId,
      lessonId: lesson._id,
      completionStatus: "completed",
    }),
  ]);

  const studiedPercent = completionRatioPercent(studiedCount, classActiveStudentsTotal);

  return { classActiveStudentsTotal, studiedCount, studiedPercent };
}

async function linkedAssignmentsSummaryForLesson(
  schoolId: mongoose.Types.ObjectId,
  lessonId: mongoose.Types.ObjectId
): Promise<{
  total: number;
  published: number;
  draft: number;
  quizCount: number;
  assignmentCount: number;
} | null> {
  const rows = await Homework.aggregate<{
    _id: { status?: string; type?: string };
    n: number;
  }>([
    {
      $match: {
        schoolId,
        sourceLessonId: lessonId,
      },
    },
    {
      $group: {
        _id: { status: "$status", type: "$type" },
        n: { $sum: 1 },
      },
    },
  ]);
  if (rows.length === 0) return null;

  let total = 0;
  let published = 0;
  let draft = 0;
  let quizCount = 0;
  let assignmentCount = 0;
  for (const r of rows) {
    total += r.n;
    if (r._id.status === "published") published += r.n;
    if (r._id.status === "draft") draft += r.n;
    if (r._id.type === "quiz") quizCount += r.n;
    if (
      r._id.type === "assignment" ||
      r._id.type === "project" ||
      r._id.type === "practice"
    ) {
      assignmentCount += r.n;
    }
  }
  return { total, published, draft, quizCount, assignmentCount };
}

function formatLessonDetail(
  lesson: ILesson,
  noteTopic: string | null,
  opts?: {
    classDisplayLabel?: string | null;
    subjectName?: string | null;
    displayNote?: unknown | null;
  }
) {
  return {
    id: String(lesson._id),
    schoolId: String(lesson.schoolId),
    teacherId: String(lesson.teacherId),
    lessonNoteId: String(lesson.lessonNoteId),
    lessonNoteTopic: noteTopic,
    classGroupId: String(lesson.classGroupId),
    subjectId: lesson.subjectId ? String(lesson.subjectId) : null,
    academicPeriodId: lesson.academicPeriodId ? String(lesson.academicPeriodId) : null,
    title: lesson.title,
    scheduledAt: lesson.scheduledAt ? new Date(lesson.scheduledAt).toISOString() : null,
    status: lesson.status,
    publishedAt: lesson.publishedAt ? new Date(lesson.publishedAt).toISOString() : null,
    publishedSnapshot: lesson.publishedSnapshot ?? null,
    teachingMode: formatTeachingModeDto(lesson),
    parentSummaryHtml: lesson.parentSummaryHtml ?? null,
    collaboratorTeacherIds: (lesson.collaboratorTeacherIds ?? []).map((id) => String(id)),
    createdAt: lesson.createdAt ? new Date(lesson.createdAt).toISOString() : null,
    updatedAt: lesson.updatedAt ? new Date(lesson.updatedAt).toISOString() : null,
    ...(opts?.classDisplayLabel !== undefined
      ? { classDisplayLabel: opts.classDisplayLabel }
      : {}),
    ...(opts?.subjectName !== undefined ? { subjectName: opts.subjectName } : {}),
    ...(opts?.displayNote !== undefined ? { displayNote: opts.displayNote } : {}),
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
    }).lean()) as ILesson | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }
    const canCollaborate = await canTeacherCollaborateOnLesson(
      context.schoolId,
      context.teacherId,
      lesson
    );
    if (!canCollaborate) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const note = (await LessonNote.findById(lesson.lessonNoteId)
      .select("topic")
      .lean()) as Pick<ILessonNote, "topic"> | null;

    const includeDisplayNote = new URL(req.url).searchParams.get("includeDisplayNote") === "1";

    let classDisplayLabel: string | null = null;
    let subjectName: string | null = null;
    let displayNote: unknown | null = null;

    if (includeDisplayNote) {
      const labels = await resolveClassAndSubjectLabels(lesson);
      classDisplayLabel = labels.classDisplayLabel;
      subjectName = labels.subjectName;

      const snap = lesson.publishedSnapshot;
      if (snap && typeof snap === "object" && "topic" in snap && "templateType" in snap) {
        displayNote = lessonSnapshotToStudentDisplayNote(
          lesson,
          snap as ILessonPublishedSnapshot,
          classDisplayLabel,
          subjectName
        );
      }
    }

    const [snapshot, linkedAssignmentsSummary, collaborators] = await Promise.all([
      studentCompletionSnapshotForLesson(context.schoolId, lesson),
      can(context.permissions, PERMISSIONS.assignmentsView)
        ? linkedAssignmentsSummaryForLesson(context.schoolId, lesson._id)
        : Promise.resolve(null),
      resolveLessonCollaborators(context.schoolId, lesson),
    ]);

    const lessonsSettings = (await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("lessonsModule")
      .lean()) as { lessonsModule?: { parentSummaryVisibleToParents?: boolean } } | null;

    const parentSummaryVisibleToParents = Boolean(
      lessonsSettings?.lessonsModule?.parentSummaryVisibleToParents
    );

    return Response.json({
      success: true,
      data: {
        ...formatLessonDetail(lesson, note?.topic ?? null, {
          ...(includeDisplayNote
            ? { classDisplayLabel, subjectName, displayNote }
            : {}),
        }),
        parentSummaryVisibleToParents,
        linkedAssignmentsSummary,
        collaboration: {
          role: String(lesson.teacherId) === String(context.teacherId) ? "owner" : "collaborator",
          collaborators,
        },
        studentCompletionSnapshot: snapshot,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch lesson:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const existing = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
    })
      .select("status lessonNoteId classGroupId title teacherId collaboratorTeacherIds subjectId academicPeriodId")
      .lean()) as Pick<
      ILesson,
      | "status"
      | "lessonNoteId"
      | "classGroupId"
      | "title"
      | "teacherId"
      | "collaboratorTeacherIds"
      | "subjectId"
      | "academicPeriodId"
    > | null;

    if (!existing) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }
    const canCollaborate = await canTeacherCollaborateOnLesson(
      context.schoolId,
      context.teacherId,
      existing as ILesson
    );
    if (!canCollaborate) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }
    const isOwner = String(existing.teacherId) === String(context.teacherId);

    const previousStatus = existing.status;

    const raw = await req.json().catch(() => null);
    const parsed = PatchLessonBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg =
        parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const setData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) {
      setData.title = parsed.data.title;
    }

    if (parsed.data.teachingMode !== undefined) {
      setData.teachingMode = normalizeTeachingModePatch(parsed.data.teachingMode);
    }

    if (parsed.data.parentSummaryHtml !== undefined) {
      if (parsed.data.parentSummaryHtml === null) {
        unsetData.parentSummaryHtml = "";
      } else {
        setData.parentSummaryHtml = normalizeParentSummaryHtmlInput(parsed.data.parentSummaryHtml);
      }
    }
    if (parsed.data.collaboratorTeacherIds !== undefined) {
      if (!isOwner) {
        return Response.json(
          { success: false, error: "Only lesson owner can manage collaborators" },
          { status: 403 }
        );
      }
      const normalizedTeacherIds = Array.from(new Set(parsed.data.collaboratorTeacherIds))
        .map((candidate) => toObjectIdOrNull(candidate))
        .filter((candidate): candidate is mongoose.Types.ObjectId => candidate !== null)
        .filter((candidate) => String(candidate) !== String(existing.teacherId));
      let allowedCollaboratorIds: string[] = [];
      if (normalizedTeacherIds.length > 0) {
        const allowedCollaborators = await Teacher.find({
          _id: { $in: normalizedTeacherIds },
          schoolId: context.schoolId,
          status: { $in: ["active", "on_leave"] },
        })
          .select("_id")
          .lean();
        allowedCollaboratorIds = allowedCollaborators.map((row) => String(row._id));
      }
      const validation = validateCollaboratorTeacherIdsInput({
        collaboratorTeacherIds: parsed.data.collaboratorTeacherIds,
        ownerTeacherId: existing.teacherId,
        allowedTeacherIds: allowedCollaboratorIds,
      });
      if (!validation.ok) {
        return Response.json({ success: false, error: validation.error }, { status: validation.status });
      }
      setData.collaboratorTeacherIds = validation.collaboratorTeacherIds;
    }

    if ("scheduledAt" in parsed.data) {
      if (parsed.data.scheduledAt) {
        const d = new Date(parsed.data.scheduledAt);
        if (Number.isNaN(d.getTime())) {
          return Response.json({ success: false, error: "Invalid scheduled date" }, { status: 400 });
        }
        setData.scheduledAt = d;
      } else {
        setData.scheduledAt = null;
      }
    }

    if (parsed.data.status !== undefined) {
      if (!isOwner) {
        return Response.json(
          { success: false, error: "Only lesson owner can change status" },
          { status: 403 }
        );
      }
      setData.status = parsed.data.status;

      if (parsed.data.status === "published") {
        const note = (await LessonNote.findOne({
          _id: existing.lessonNoteId,
          schoolId: context.schoolId,
          teacherId: context.teacherId,
        }).lean()) as ILessonNote | null;

        if (!note) {
          return Response.json(
            { success: false, error: "Lesson note not found — cannot publish without source note" },
            { status: 400 }
          );
        }

        setData.publishedSnapshot = buildPublishedSnapshotFromLessonNote(note);
        setData.publishedAt = new Date();
      } else if (parsed.data.status === "draft") {
        setData.publishedAt = null;
        unsetData.publishedSnapshot = "";
      }
    }

    if (Object.keys(setData).length === 0 && Object.keys(unsetData).length === 0) {
      return Response.json({ success: true });
    }

    const updatePayload: Record<string, unknown> = {};
    if (Object.keys(setData).length > 0) {
      updatePayload.$set = setData;
    }
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    await Lesson.updateOne({ _id: lessonId }, updatePayload);

    if (parsed.data.status === "published" && setData.publishedAt instanceof Date) {
      void recordLessonAudit({
        schoolId: context.schoolId,
        lessonId,
        actorId: context.userId,
        action: "lesson_published",
        metadata: {
          previousStatus,
          publishedAt: setData.publishedAt.toISOString(),
        },
        httpRequest: req,
        actorRole: context.isAdmin ? "school_admin" : "teacher",
      });
    } else if (
      parsed.data.status === "draft" &&
      (previousStatus === "published" || previousStatus === "archived")
    ) {
      void recordLessonAudit({
        schoolId: context.schoolId,
        lessonId,
        actorId: context.userId,
        action: "lesson_unpublished",
        metadata: { previousStatus },
        httpRequest: req,
        actorRole: context.isAdmin ? "school_admin" : "teacher",
      });
    } else if (parsed.data.status === "archived" && previousStatus !== "archived") {
      void recordLessonAudit({
        schoolId: context.schoolId,
        lessonId,
        actorId: context.userId,
        action: "lesson_archived",
        metadata: { previousStatus },
        httpRequest: req,
        actorRole: context.isAdmin ? "school_admin" : "teacher",
      });
    } else if (
      parsed.data.status === undefined &&
      (parsed.data.title !== undefined ||
        parsed.data.teachingMode !== undefined ||
        "scheduledAt" in parsed.data ||
        parsed.data.parentSummaryHtml !== undefined ||
        parsed.data.collaboratorTeacherIds !== undefined)
    ) {
      const fields: string[] = [];
      if (parsed.data.title !== undefined) fields.push("title");
      if (parsed.data.teachingMode !== undefined) fields.push("teachingMode");
      if ("scheduledAt" in parsed.data) fields.push("scheduledAt");
      if (parsed.data.parentSummaryHtml !== undefined) fields.push("parentSummaryHtml");
      if (parsed.data.collaboratorTeacherIds !== undefined) fields.push("collaboratorTeacherIds");
      void recordLessonAudit({
        schoolId: context.schoolId,
        lessonId,
        actorId: context.userId,
        action: "lesson_updated",
        metadata: { fields },
        httpRequest: req,
        actorRole: context.isAdmin ? "school_admin" : "teacher",
      });
    }

    if (
      parsed.data.status === "published" &&
      setData.publishedAt instanceof Date &&
      existing.classGroupId
    ) {
      const lessonTitle =
        parsed.data.title !== undefined ? parsed.data.title : existing.title;
      void notifyStudentsOfPublishedLesson({
        schoolId: context.schoolId,
        lessonId,
        classGroupId: existing.classGroupId,
        lessonTitle,
        publishedAt: setData.publishedAt,
      }).catch((err) => {
        console.error("[lessons] notifyStudentsOfPublishedLesson failed:", err);
      });

      void (async () => {
        try {
          const cardCount = await LessonFlashcard.countDocuments({
            schoolId: context.schoolId,
            lessonId,
          });
          if (cardCount > 0) {
            await recordLessonAudit({
              schoolId: context.schoolId,
              lessonId,
              actorId: context.userId,
              action: "flashcards_published",
              metadata: {
                cardCount,
                withLessonPublish: true,
                publishedAt:
                  setData.publishedAt instanceof Date
                    ? setData.publishedAt.toISOString()
                    : undefined,
              },
              httpRequest: req,
              actorRole: context.isAdmin ? "school_admin" : "teacher",
            });
          }
        } catch (e) {
          console.error("[lessons] flashcards_published audit failed:", e);
        }
      })();
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson:", e);
    const message = e instanceof Error ? e.message : "Failed to update lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const existing = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
    })
      .select("status teacherId")
      .lean()) as Pick<ILesson, "status" | "teacherId"> | null;

    if (!existing) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }
    if (String(existing.teacherId) !== String(context.teacherId)) {
      return Response.json(
        { success: false, error: "Only lesson owner can delete this lesson" },
        { status: 403 }
      );
    }

    if (existing.status !== "draft") {
      return Response.json(
        { success: false, error: "Only draft lessons can be deleted" },
        { status: 403 }
      );
    }

    await Lesson.deleteOne({ _id: lessonId });

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete lesson:", e);
    const message = e instanceof Error ? e.message : "Failed to delete lesson";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
