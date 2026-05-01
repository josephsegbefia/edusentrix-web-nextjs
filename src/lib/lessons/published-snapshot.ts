import type { ILessonNote } from "@/models/LessonNote";
import type { ILesson, ILessonPublishedSnapshot } from "@/models/Lesson";
import type { LessonNoteDetail, LessonNoteTemplateType } from "@/types/lesson-notes";

export function buildPublishedSnapshotFromLessonNote(
  note: Pick<
    ILessonNote,
    | "topic"
    | "templateType"
    | "curriculumCode"
    | "references"
    | "curriculum"
    | "tlms"
    | "body"
    | "assessment"
    | "resources"
    | "durationMinutes"
  >
): ILessonPublishedSnapshot {
  return {
    topic: note.topic,
    templateType: String(note.templateType || "SIMPLE"),
    curriculumCode: note.curriculumCode,
    references: note.references || [],
    curriculum: note.curriculum,
    tlms: note.tlms || [],
    body: note.body ?? null,
    assessment: note.assessment,
    resources: (note.resources || []).map((r) => ({
      title: r.title,
      url: r.url,
      type: r.type,
    })),
    durationMinutes: note.durationMinutes ?? null,
  };
}

function iso(d: Date | undefined | null): string {
  if (!d) return new Date().toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/**
 * Build a read-only lesson note shape for `LessonNoteReadonlyView` from a published lesson + snapshot.
 * Uses `lesson.title` as the student-facing headline (may differ from the original note topic).
 */
export function lessonSnapshotToStudentDisplayNote(
  lesson: Pick<
    ILesson,
    | "_id"
    | "schoolId"
    | "teacherId"
    | "classGroupId"
    | "subjectId"
    | "academicPeriodId"
    | "title"
    | "publishedAt"
    | "scheduledAt"
    | "createdAt"
    | "updatedAt"
  >,
  snapshot: ILessonPublishedSnapshot,
  className: string,
  subjectName: string | null
): LessonNoteDetail {
  const weekStamp =
    lesson.scheduledAt || lesson.publishedAt || lesson.updatedAt || lesson.createdAt;

  return {
    id: String(lesson._id),
    schoolId: String(lesson.schoolId),
    teacherId: String(lesson.teacherId),
    classGroupId: String(lesson.classGroupId),
    className,
    subjectId: lesson.subjectId ? String(lesson.subjectId) : undefined,
    subjectName: subjectName || undefined,
    academicPeriodId: lesson.academicPeriodId ? String(lesson.academicPeriodId) : undefined,
    templateType: snapshot.templateType as LessonNoteTemplateType,
    curriculumCode: snapshot.curriculumCode,
    unitPlannerData: undefined,
    weekOf: iso(weekStamp),
    date: lesson.scheduledAt ? iso(lesson.scheduledAt) : undefined,
    topic: lesson.title,
    durationMinutes: snapshot.durationMinutes ?? undefined,
    references: snapshot.references || [],
    curriculum: snapshot.curriculum as LessonNoteDetail["curriculum"],
    tlms: snapshot.tlms || [],
    body: snapshot.body as LessonNoteDetail["body"],
    assessment: snapshot.assessment as LessonNoteDetail["assessment"],
    reflections: undefined,
    resources: snapshot.resources || [],
    tags: [],
    status: "published",
    submittedAt: undefined,
    approvedAt: undefined,
    approvedBy: undefined,
    rejectionReason: undefined,
    exportUrls: undefined,
    content: undefined,
    objectives: undefined,
    createdAt: iso(lesson.createdAt),
    updatedAt: iso(lesson.updatedAt),
    teacherName: null,
    reviewComments: [],
    openCommentCount: 0,
  };
}
