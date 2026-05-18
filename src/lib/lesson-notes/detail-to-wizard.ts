import {
  DEFAULT_SIMPLE_BODY,
  type LessonNoteDetail,
  type LessonNoteFormData,
  type LessonNoteStatus,
  type LessonNoteTemplateType,
} from "@/types/lesson-notes";

/** Map API lesson note detail into wizard initial data. */
export function lessonNoteDetailToWizardInitial(note: LessonNoteDetail): LessonNoteFormData & { id: string } {
  return {
    id: note.id,
    classGroupId: note.classGroupId,
    subjectId: note.subjectId || undefined,
    templateType: note.templateType as LessonNoteTemplateType,
    weekOf: note.weekOf ? new Date(note.weekOf) : new Date(),
    date: note.date ? new Date(note.date) : undefined,
    weekEndingDate: note.weekEndingDate ? new Date(note.weekEndingDate) : undefined,
    topic: note.topic,
    durationMinutes: note.durationMinutes || undefined,
    references: note.references || [],
    curriculum: note.curriculum || {
      strand: "",
      subStrand: "",
      contentStandard: "",
      indicators: [],
      learningOutcomes: [],
    },
    tlms: note.tlms || [],
    body: note.body || DEFAULT_SIMPLE_BODY,
    assessment: note.assessment || {
      inClassChecks: [],
      exitTicket: "",
      homework: "",
    },
    reflections: note.reflections || {
      learner: "",
      teacher: "",
      nextLessonLink: "",
    },
    resources: note.resources,
    tags: note.tags,
    status: note.status as LessonNoteStatus,
    schemeId: note.schemeId ?? undefined,
    schemeItemIds: note.schemeItemIds ?? [],
  };
}
