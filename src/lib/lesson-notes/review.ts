import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";
import {
  DEFAULT_ASSESSMENT,
  DEFAULT_REFLECTIONS,
  getDefaultBodyForTemplate,
  type LessonNote,
  type LessonNoteFormData,
  type LessonNoteReviewComment,
  type LessonNoteReviewCommentStatus,
  type LessonNoteReviewCommentType,
  type LessonNoteTemplateType,
} from "@/types/lesson-notes";

export const REVIEW_COMMENT_TYPE_OPTIONS: Array<{
  value: LessonNoteReviewCommentType;
  label: string;
  toneClassName: string;
}> = [
  {
    value: "required_change",
    label: "Required Change",
    toneClassName: "bg-rose-500/15 text-rose-200 border-rose-400/25",
  },
  {
    value: "suggestion",
    label: "Suggestion",
    toneClassName: "bg-amber-500/15 text-amber-200 border-amber-400/25",
  },
  {
    value: "question",
    label: "Question",
    toneClassName: "bg-sky-500/15 text-sky-200 border-sky-400/25",
  },
  {
    value: "commendation",
    label: "Commendation",
    toneClassName: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
  },
];

export const REVIEW_COMMENT_STATUS_OPTIONS: Array<{
  value: LessonNoteReviewCommentStatus;
  label: string;
  toneClassName: string;
}> = [
  {
    value: "open",
    label: "Open",
    toneClassName: "bg-rose-500/15 text-rose-200 border-rose-400/25",
  },
  {
    value: "addressed",
    label: "Addressed",
    toneClassName: "bg-amber-500/15 text-amber-200 border-amber-400/25",
  },
  {
    value: "resolved",
    label: "Resolved",
    toneClassName: "bg-emerald-500/15 text-emerald-200 border-emerald-400/25",
  },
];

export type LessonNoteReviewSection = {
  key: string;
  label: string;
  stepId: string;
};

export function formatUserDisplayName(
  user:
    | {
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback = "Unknown user"
) {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return user?.name?.trim() || fullName || user?.email?.trim() || fallback;
}

export function getReviewCommentTypeMeta(type: LessonNoteReviewCommentType) {
  return (
    REVIEW_COMMENT_TYPE_OPTIONS.find((option) => option.value === type) ||
    REVIEW_COMMENT_TYPE_OPTIONS[1]
  );
}

export function getReviewCommentStatusMeta(status: LessonNoteReviewCommentStatus) {
  return (
    REVIEW_COMMENT_STATUS_OPTIONS.find((option) => option.value === status) ||
    REVIEW_COMMENT_STATUS_OPTIONS[0]
  );
}

export function groupReviewCommentsBySection(
  comments: LessonNoteReviewComment[]
) {
  return comments.reduce<Record<string, LessonNoteReviewComment[]>>((acc, comment) => {
    if (!acc[comment.sectionKey]) {
      acc[comment.sectionKey] = [];
    }
    acc[comment.sectionKey].push(comment);
    return acc;
  }, {});
}

export function countOpenReviewComments(comments: LessonNoteReviewComment[]) {
  return comments.filter((comment) => comment.status !== "resolved").length;
}

export function getLessonNoteReviewSections(note: {
  templateType: LessonNoteTemplateType;
}) {
  const sections: LessonNoteReviewSection[] = [
    { key: "context", label: "Context", stepId: "context" },
    { key: "curriculum", label: "Curriculum", stepId: "curriculum" },
  ];

  const templateDefinition = getTemplateDefinition(note.templateType);
  for (const section of templateDefinition?.unitSections || []) {
    sections.push({
      key: section.key,
      label: section.label,
      stepId: section.key,
    });
  }

  sections.push(
    { key: "resources", label: "Resources", stepId: "resources" },
    { key: "body", label: "Lesson Body", stepId: "body" },
    { key: "assessment", label: "Assessment", stepId: "assessment" },
    { key: "reflections", label: "Reflections", stepId: "assessment" }
  );

  return sections.filter(
    (section, index, all) =>
      all.findIndex((candidate) => candidate.key === section.key) === index
  );
}

export function lessonNoteToFormData(note: LessonNote): LessonNoteFormData {
  return {
    classGroupId: note.classGroupId,
    subjectId: note.subjectId || undefined,
    templateType: note.templateType,
    curriculumCode: note.curriculumCode,
    curriculumMetadata: note.curriculumMetadata || {},
    unitPlannerData: note.unitPlannerData || {},
    weekOf: note.weekOf ? new Date(note.weekOf) : new Date(),
    date: note.date ? new Date(note.date) : undefined,
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
    body: note.body || getDefaultBodyForTemplate(note.templateType),
    assessment: note.assessment || { ...DEFAULT_ASSESSMENT },
    reflections: note.reflections || { ...DEFAULT_REFLECTIONS },
    resources: note.resources || [],
    tags: note.tags || [],
    status: note.status,
  };
}
