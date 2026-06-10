import type { SchemeItemRow } from "@/types/schemes";
import type { LessonNoteFormData } from "@/types/lesson-notes";
import {
  isClassicJHSBody,
  isNaCCA3PhaseBody,
  isSimpleBody,
  isThreePhaseTemplate,
} from "@/types/lesson-notes";
import { sanitizeRichTextField } from "@/lib/lesson-notes/plain-text-content";

function mergeText(existing: string | undefined, incoming: string): string {
  const prev = sanitizeRichTextField(existing);
  const next = sanitizeRichTextField(incoming);
  if (!next) return prev;
  if (!prev) return next;
  if (prev.includes(next)) return prev;
  return `${next}\n\n${prev}`;
}

export function buildLessonNoteUpdatesFromSchemeRows(
  formData: LessonNoteFormData,
  selectedItems: SchemeItemRow[]
): Partial<LessonNoteFormData> | null {
  const primary = selectedItems[0];
  if (!primary) return null;

  const indicatorText = selectedItems
    .flatMap((item) => (item.indicator || "").split(/\n|,/))
    .map((s) => s.trim())
    .filter(Boolean);

  const resources = selectedItems
    .flatMap((item) => item.teachingResources || [])
    .map((s) => s.trim())
    .filter(Boolean);

  const incomingObjectives = selectedItems
    .flatMap((item) => item.learningObjectives ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

  const existingOutcomes: string[] = (formData.curriculum?.learningOutcomes ?? []) as string[];
  const mergedOutcomes = Array.from(new Set([...existingOutcomes, ...incomingObjectives]));

  const incomingAssessment = selectedItems
    .flatMap((item) => item.assessmentIdeas ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

  const existingChecks: string[] = (formData.assessment?.inClassChecks ?? []) as string[];
  const mergedChecks = Array.from(new Set([...existingChecks, ...incomingAssessment]));

  const teachingActivities = selectedItems
    .map((item) => item.teachingLearningActivities?.trim())
    .filter(Boolean)
    .join("\n\n");

  const resourcesLine = resources.join("; ");
  const assessmentLine = incomingAssessment.join("; ");

  let nextBody = formData.body;

  if (isThreePhaseTemplate(formData.templateType) && isNaCCA3PhaseBody(formData.body)) {
    const body = formData.body;
    nextBody = {
      ...body,
      main: {
        ...body.main,
        ...(teachingActivities
          ? { teacherActivities: mergeText(body.main.teacherActivities, teachingActivities) }
          : {}),
        ...(resourcesLine
          ? { resourcesUsed: mergeText(body.main.resourcesUsed, resourcesLine) }
          : {}),
        ...(assessmentLine
          ? { embeddedAssessment: mergeText(body.main.embeddedAssessment, assessmentLine) }
          : {}),
      },
      plenary: {
        ...body.plenary,
        ...(incomingAssessment[0]
          ? { homework: mergeText(body.plenary.homework, incomingAssessment[0]) }
          : {}),
      },
    };
  } else if (formData.templateType === "CLASSIC_JHS" && isClassicJHSBody(formData.body)) {
    const body = formData.body;
    nextBody = {
      ...body,
      ...(teachingActivities
        ? { introduction: mergeText(body.introduction, teachingActivities) }
        : {}),
    };
  } else if (isSimpleBody(formData.body)) {
    const body = formData.body;
    nextBody = {
      ...body,
      ...(teachingActivities
        ? { content: mergeText(body.content, teachingActivities) }
        : {}),
    };
  }

  return {
    topic: formData.topic.trim() ? formData.topic : primary.title || formData.topic,
    curriculum: {
      ...formData.curriculum,
      strand: primary.strand || formData.curriculum.strand,
      subStrand: primary.subStrand || formData.curriculum.subStrand,
      contentStandard: primary.contentStandard || formData.curriculum.contentStandard,
      indicators: indicatorText.length
        ? indicatorText.map((text) => ({ refNo: text, text }))
        : formData.curriculum.indicators,
      learningOutcomes: mergedOutcomes.length ? mergedOutcomes : existingOutcomes,
    },
    tlms: Array.from(new Set([...formData.tlms, ...resources])),
    references: Array.from(
      new Set(
        [...formData.references, primary.contentStandard, ...indicatorText].filter(
          Boolean
        ) as string[]
      )
    ),
    assessment: {
      ...(formData.assessment as Record<string, unknown> | undefined),
      inClassChecks: mergedChecks,
    },
    body: nextBody,
  };
}
