import type { LessonNoteFormData, LessonNoteResource } from "@/types/lesson-notes";
import type { UnitPlannerSection } from "@/constants/curriculum-lesson-templates";
import { isClassicJHSBody, isNaCCA3PhaseBody, isSimpleBody } from "@/types/lesson-notes";

type ClassOption = {
  id: string;
  label: string;
  subjects: Array<{ id: string; name: string }>;
};

function stripHtml(value?: string | null) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(value: string, max = 220) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}...`;
}

function summarizeResources(resources: LessonNoteResource[]) {
  if (!resources.length) return "";
  return resources
    .slice(0, 5)
    .map((resource) => `${resource.title || "Untitled"}${resource.type ? ` (${resource.type})` : ""}`)
    .join(", ");
}

export function summarizeLessonBodyForAI(formData: LessonNoteFormData) {
  if (isNaCCA3PhaseBody(formData.body)) {
    return [
      formData.body.starter?.activities &&
        `Starter: ${clip(stripHtml(formData.body.starter.activities))}`,
      formData.body.main?.teacherActivities &&
        `Main teacher activity: ${clip(stripHtml(formData.body.main.teacherActivities))}`,
      formData.body.main?.learnerActivities &&
        `Main learner activity: ${clip(stripHtml(formData.body.main.learnerActivities))}`,
      formData.body.plenary?.summaryPoints &&
        `Plenary: ${clip(stripHtml(formData.body.plenary.summaryPoints))}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (isClassicJHSBody(formData.body)) {
    return [
      formData.body.objectives?.general &&
        `General objective: ${clip(formData.body.objectives.general)}`,
      formData.body.rpk && `RPK: ${clip(stripHtml(formData.body.rpk))}`,
      formData.body.introduction &&
        `Introduction: ${clip(stripHtml(formData.body.introduction))}`,
      formData.body.presentationSteps?.length &&
        `Presentation steps: ${formData.body.presentationSteps.length}`,
      formData.body.corePoints?.length &&
        `Core points: ${formData.body.corePoints.filter(Boolean).length}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (isSimpleBody(formData.body)) {
    return [
      formData.body.objectives &&
        `Objectives: ${clip(stripHtml(formData.body.objectives))}`,
      formData.body.content && `Content: ${clip(stripHtml(formData.body.content))}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export function summarizeAssessmentForAI(formData: LessonNoteFormData) {
  return [
    formData.assessment.inClassChecks?.length &&
      `In-class checks: ${formData.assessment.inClassChecks.filter(Boolean).length}`,
    formData.assessment.exitTicket &&
      `Exit ticket: ${clip(stripHtml(formData.assessment.exitTicket))}`,
    formData.assessment.homework &&
      `Homework: ${clip(stripHtml(formData.assessment.homework))}`,
    formData.reflections.learner &&
      `Learner reflection: ${clip(stripHtml(formData.reflections.learner))}`,
    formData.reflections.teacher &&
      `Teacher reflection: ${clip(stripHtml(formData.reflections.teacher))}`,
    formData.reflections.nextLessonLink &&
      `Next lesson link: ${clip(formData.reflections.nextLessonLink)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLessonNoteAIContextSummary({
  formData,
  classOptions,
  stepIds,
  currentStep,
  unitSections,
}: {
  formData: LessonNoteFormData;
  classOptions: ClassOption[];
  stepIds: string[];
  currentStep: string;
  unitSections?: UnitPlannerSection[];
}) {
  const selectedClass = classOptions.find((option) => option.id === formData.classGroupId);
  const subjectName =
    selectedClass?.subjects.find((subject) => subject.id === formData.subjectId)?.name ||
    null;
  const currentStepIndex = stepIds.indexOf(currentStep);
  const includeStep = (stepId: string) => {
    const index = stepIds.indexOf(stepId);
    return index >= 0 && index < currentStepIndex;
  };

  const parts = [
    selectedClass?.label && `Class: ${selectedClass.label}`,
    subjectName && `Subject: ${subjectName}`,
    formData.topic && `Topic: ${formData.topic}`,
    formData.durationMinutes && `Planned duration: ${formData.durationMinutes} minutes`,
    formData.references[0] && `Reference: ${formData.references[0]}`,
  ].filter(Boolean);

  if (includeStep("curriculum")) {
    if (formData.curriculum?.strand) {
      parts.push(`Strand: ${formData.curriculum.strand}`);
    }
    if (formData.curriculum?.subStrand) {
      parts.push(`Sub-strand: ${formData.curriculum.subStrand}`);
    }
    if (formData.curriculum?.contentStandard) {
      parts.push(
        `Content standard: ${clip(stripHtml(formData.curriculum.contentStandard), 260)}`
      );
    }
    if (formData.curriculum?.indicators?.length) {
      parts.push(
        `Indicators: ${formData.curriculum.indicators
          .map((indicator) => `${indicator.refNo} ${indicator.text}`.trim())
          .filter(Boolean)
          .slice(0, 5)
          .join("; ")}`
      );
    }
    if (formData.curriculum?.learningOutcomes?.length) {
      parts.push(
        `Learning outcomes: ${formData.curriculum.learningOutcomes
          .filter(Boolean)
          .slice(0, 5)
          .join("; ")}`
      );
    }
  }

  if (includeStep("resources")) {
    if (formData.tlms.length) {
      parts.push(`TLMs: ${formData.tlms.slice(0, 8).join(", ")}`);
    }
    const resourceSummary = summarizeResources(formData.resources);
    if (resourceSummary) {
      parts.push(`Resources: ${resourceSummary}`);
    }
  }

  if (includeStep("body")) {
    const bodySummary = summarizeLessonBodyForAI(formData);
    if (bodySummary) {
      parts.push(bodySummary);
    }
  }

  if (includeStep("assessment")) {
    const assessmentSummary = summarizeAssessmentForAI(formData);
    if (assessmentSummary) {
      parts.push(assessmentSummary);
    }
  }

  if (currentStepIndex > 0 && formData.unitPlannerData) {
    stepIds
      .slice(0, currentStepIndex)
      .filter(
        (stepId) =>
          !["context", "curriculum", "resources", "body", "assessment", "review"].includes(
            stepId
          )
      )
      .forEach((stepId) => {
        const section = unitSections?.find((candidate) => candidate.key === stepId);
        if (!section) {
          return;
        }

        const sectionSummary = section.fields
          .map((field) => {
            const value = formData.unitPlannerData?.[field.key];
            if (typeof value === "string" && value.trim()) {
              return `${field.label}: ${clip(stripHtml(value))}`;
            }
            if (Array.isArray(value) && value.length) {
              const flattened = value
                .map((entry) => {
                  if (typeof entry === "string") {
                    return entry.trim();
                  }
                  if (
                    entry &&
                    typeof entry === "object" &&
                    "text" in entry &&
                    typeof entry.text === "string"
                  ) {
                    return entry.text.trim();
                  }
                  return "";
                })
                .filter(Boolean)
                .slice(0, 4)
                .join("; ");
              if (flattened) {
                return `${field.label}: ${flattened}`;
              }
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");

        if (sectionSummary) {
          parts.push(`${section.label}:\n${sectionSummary}`);
        }
      });
  }

  return parts.filter(Boolean).join("\n");
}

export function summarizeCurrentSectionText(value?: string | null, max = 800) {
  return clip(stripHtml(value), max);
}
