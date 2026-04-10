import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";
import type { UnitPlannerSection } from "@/constants/curriculum-lesson-templates";
import {
  buildLessonNoteAIContextSummary,
  summarizeAssessmentForAI,
  summarizeLessonBodyForAI,
} from "@/lib/lesson-notes/ai-context";
import {
  buildAIFieldBlueprint,
  normalizeAISuggestedFieldValue,
} from "@/lib/lesson-notes/ai-field-suggestions";
import { getLessonNoteReviewSections, lessonNoteToFormData } from "@/lib/lesson-notes/review";
import type {
  AIGenerateResponse,
  AIFieldBlueprint,
  AssessmentSectionGenerated,
  FieldSuggestionsGenerated,
  RefinedContextGenerated,
  ResourceSuggestionsGenerated,
} from "@/hooks/teacher/useTeacherAIGenerate";
import type {
  LessonNoteDetail,
  LessonNoteFormData,
  LessonNoteResource,
  LessonNoteReviewComment,
  UpdateLessonNotePayload,
  ClassicJHSBody,
  NaCCA3PhaseBody,
  SimpleBody,
} from "@/types/lesson-notes";
import {
  isClassicJHSBody,
  isNaCCA3PhaseBody,
  isSimpleBody,
} from "@/types/lesson-notes";

type SectionAIConfig = {
  action:
    | "refine_context"
    | "suggest_field_values"
    | "suggest_resources"
    | "generate_body"
    | "generate_assessment_section";
  sectionLabel: string;
  existingContent: string;
  fieldBlueprint?: AIFieldBlueprint[];
};

function summarizeResourcesForAI(formData: LessonNoteFormData) {
  return [
    formData.tlms.length ? `Selected TLMs: ${formData.tlms.join(", ")}` : "",
    formData.resources.length
      ? `External resources: ${formData.resources
          .map(
            (resource) =>
              `${resource.title || "Untitled"}${resource.type ? ` (${resource.type})` : ""}`
          )
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeUnitPlannerSection(section: UnitPlannerSection, data: Record<string, unknown>) {
  return section.fields
    .map((field) => {
      const value = data[field.key];
      if (typeof value === "string" && value.trim()) {
        return `${field.label}: ${value.trim()}`;
      }
      if (Array.isArray(value) && value.length) {
        const summary = value
          .map((item) => {
            if (typeof item === "string") {
              return item.trim();
            }
            if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
              return item.text.trim();
            }
            return "";
          })
          .filter(Boolean)
          .join("; ");
        if (summary) {
          return `${field.label}: ${summary}`;
        }
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function buildClassOptionsFromNote(note: LessonNoteDetail) {
  return [
    {
      id: note.classGroupId,
      label: note.className || "Current class",
      subjects:
        note.subjectId && note.subjectName
          ? [{ id: note.subjectId, name: note.subjectName }]
          : [],
    },
  ];
}

function mergeThreePhaseBody(
  current: NaCCA3PhaseBody,
  generated: Record<string, unknown>
): NaCCA3PhaseBody {
  const starter =
    generated.starter && typeof generated.starter === "object" && !Array.isArray(generated.starter)
      ? generated.starter
      : {};
  const main =
    generated.main && typeof generated.main === "object" && !Array.isArray(generated.main)
      ? generated.main
      : {};
  const plenary =
    generated.plenary && typeof generated.plenary === "object" && !Array.isArray(generated.plenary)
      ? generated.plenary
      : {};

  return {
    ...current,
    ...generated,
    starter: {
      ...current.starter,
      ...starter,
    },
    main: {
      ...current.main,
      ...main,
    },
    plenary: {
      ...current.plenary,
      ...plenary,
    },
  };
}

function mergeClassicBody(
  current: ClassicJHSBody,
  generated: Record<string, unknown>
): ClassicJHSBody {
  const objectives =
    generated.objectives &&
    typeof generated.objectives === "object" &&
    !Array.isArray(generated.objectives)
      ? (generated.objectives as Partial<ClassicJHSBody["objectives"]>)
      : null;
  const evaluation =
    generated.evaluation &&
    typeof generated.evaluation === "object" &&
    !Array.isArray(generated.evaluation)
      ? (generated.evaluation as Partial<ClassicJHSBody["evaluation"]>)
      : null;

  return {
    ...current,
    ...generated,
    objectives: {
      ...current.objectives,
      ...(objectives || {}),
      specific: Array.isArray(objectives?.specific)
        ? objectives.specific.filter((item: unknown): item is string => typeof item === "string")
        : current.objectives.specific,
    },
    presentationSteps: Array.isArray(generated.presentationSteps)
      ? generated.presentationSteps.filter(
          (item): item is ClassicJHSBody["presentationSteps"][number] =>
            !!item && typeof item === "object"
        )
      : current.presentationSteps,
    corePoints: Array.isArray(generated.corePoints)
      ? generated.corePoints.filter((item): item is string => typeof item === "string")
      : current.corePoints,
    evaluation: {
      ...current.evaluation,
      ...(evaluation || {}),
      questions: Array.isArray(evaluation?.questions)
        ? evaluation.questions.filter((item: unknown): item is string => typeof item === "string")
        : current.evaluation.questions,
      answers: Array.isArray(evaluation?.answers)
        ? evaluation.answers.filter((item: unknown): item is string => typeof item === "string")
        : current.evaluation.answers,
    },
  };
}

function mergeSimpleBody(current: SimpleBody, generated: Record<string, unknown>): SimpleBody {
  return {
    ...current,
    ...(typeof generated.objectives === "string"
      ? { objectives: generated.objectives }
      : {}),
    ...(typeof generated.content === "string" ? { content: generated.content } : {}),
  };
}

function applyGeneratedBody(
  current: LessonNoteFormData["body"],
  generated: Record<string, unknown>
) {
  if (isNaCCA3PhaseBody(current)) {
    return mergeThreePhaseBody(current, generated);
  }
  if (isClassicJHSBody(current)) {
    return mergeClassicBody(current, generated);
  }
  if (isSimpleBody(current)) {
    return mergeSimpleBody(current, generated);
  }
  return current;
}

export function buildLessonNoteSectionAIContext(
  note: LessonNoteDetail,
  sectionKey: string,
  comments: LessonNoteReviewComment[] = []
) {
  const formData = lessonNoteToFormData(note);
  const templateDefinition = getTemplateDefinition(note.templateType);
  const sectionDefinition = getLessonNoteReviewSections(note).find(
    (section) => section.key === sectionKey
  );
  const currentStep =
    sectionDefinition?.stepId ||
    (sectionKey === "reflections" ? "assessment" : sectionKey) ||
    "context";
  const stepIds =
    templateDefinition?.wizardSteps.map((step) => step.id) || [
      "context",
      "curriculum",
      "resources",
      "body",
      "assessment",
      "review",
    ];
  const reviewCommentSummary = comments
    .filter((comment) => comment.status !== "resolved")
    .map((comment) => `${comment.sectionLabel}: ${comment.comment}`)
    .join("\n");

  return {
    templateType: note.templateType,
    topic: note.topic,
    subject: note.subjectName || undefined,
    gradeLevel: note.className || undefined,
    duration: note.durationMinutes || undefined,
    strand: note.curriculum?.strand,
    subStrand: note.curriculum?.subStrand,
    contentStandard: note.curriculum?.contentStandard,
    indicators: note.curriculum?.indicators
      ?.map((indicator) => indicator.text)
      .filter(Boolean),
    contextSummary: [
      buildLessonNoteAIContextSummary({
        formData,
        classOptions: buildClassOptionsFromNote(note),
        stepIds,
        currentStep,
        unitSections: templateDefinition?.unitSections,
      }),
      reviewCommentSummary ? `Reviewer notes:\n${reviewCommentSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function buildLessonNoteSectionAIConfig(
  note: LessonNoteDetail,
  sectionKey: string
): SectionAIConfig | null {
  const formData = lessonNoteToFormData(note);
  const templateDefinition = getTemplateDefinition(note.templateType);

  if (sectionKey === "context") {
    return {
      action: "refine_context",
      sectionLabel: "Context",
      existingContent: [
        note.topic && `Topic: ${note.topic}`,
        note.references[0] && `Reference: ${note.references[0]}`,
        note.durationMinutes && `Duration: ${note.durationMinutes} minutes`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (sectionKey === "curriculum") {
    const fields = templateDefinition?.curriculumFields || [];
    const isNaCCAStyle =
      note.templateType === "NACCA_3_PHASE" || note.templateType === "CLASSIC_JHS";
    const existingContent = fields
      .map((field) => {
        const value = isNaCCAStyle
          ? note.curriculum?.[field.key as keyof typeof note.curriculum]
          : note.curriculumMetadata?.[field.key];
        if (typeof value === "string" && value.trim()) {
          return `${field.label}: ${value.trim()}`;
        }
        if (Array.isArray(value) && value.length) {
          const entries = value
            .map((item) => {
              if (typeof item === "string") {
                return item.trim();
              }
              if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
                return item.text.trim();
              }
              return "";
            })
            .filter(Boolean)
            .join("; ");
          if (entries) {
            return `${field.label}: ${entries}`;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    return {
      action: "suggest_field_values",
      sectionLabel:
        templateDefinition?.wizardSteps.find((step) => step.id === "curriculum")?.label ||
        "Curriculum",
      existingContent,
      fieldBlueprint: buildAIFieldBlueprint(fields),
    };
  }

  if (sectionKey === "resources") {
    return {
      action: "suggest_resources",
      sectionLabel: "Resources",
      existingContent: summarizeResourcesForAI(formData),
    };
  }

  if (sectionKey === "body") {
    return {
      action: "generate_body",
      sectionLabel: "Lesson Body",
      existingContent: summarizeLessonBodyForAI(formData),
    };
  }

  if (sectionKey === "assessment") {
    return {
      action: "generate_assessment_section",
      sectionLabel: "Assessment",
      existingContent: summarizeAssessmentForAI(formData),
    };
  }

  if (sectionKey === "reflections") {
    return {
      action: "generate_assessment_section",
      sectionLabel: "Reflections",
      existingContent: [
        note.reflections?.learner && `Learner reflection: ${note.reflections.learner}`,
        note.reflections?.teacher && `Teacher reflection: ${note.reflections.teacher}`,
        note.reflections?.nextLessonLink &&
          `Link to next lesson: ${note.reflections.nextLessonLink}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  const section = templateDefinition?.unitSections?.find((item) => item.key === sectionKey);
  if (!section) {
    return null;
  }

  return {
    action: "suggest_field_values",
    sectionLabel: section.label,
    existingContent: summarizeUnitPlannerSection(section, note.unitPlannerData || {}),
    fieldBlueprint: buildAIFieldBlueprint(section.fields),
  };
}

export function applyAIResultToLessonNoteSection(
  note: LessonNoteDetail,
  sectionKey: string,
  generated: AIGenerateResponse
): Partial<UpdateLessonNotePayload> | null {
  const templateDefinition = getTemplateDefinition(note.templateType);

  if (sectionKey === "context" && "topic" in generated) {
    const contextData = generated as RefinedContextGenerated;
    return {
      topic: contextData.topic || note.topic,
      references:
        typeof contextData.reference === "string" && contextData.reference.trim()
          ? [contextData.reference.trim()]
          : note.references,
      durationMinutes:
        typeof contextData.durationMinutes === "number" &&
        Number.isFinite(contextData.durationMinutes)
          ? contextData.durationMinutes
          : note.durationMinutes,
    };
  }

  if (sectionKey === "curriculum" && "fieldSuggestions" in generated) {
    const suggestions = (generated as FieldSuggestionsGenerated).fieldSuggestions || {};
    const fields = templateDefinition?.curriculumFields || [];
    const isNaCCAStyle =
      note.templateType === "NACCA_3_PHASE" || note.templateType === "CLASSIC_JHS";

    if (isNaCCAStyle) {
      const updates: Record<string, unknown> = { ...(note.curriculum || {}) };
      for (const field of fields) {
        if (!(field.key in suggestions)) continue;
        const normalized = normalizeAISuggestedFieldValue(field, suggestions[field.key]);
        if (normalized !== undefined) {
          updates[field.key] = normalized;
        }
      }
      return {
        curriculum: updates as unknown as UpdateLessonNotePayload["curriculum"],
      };
    }

    const metadata = { ...(note.curriculumMetadata || {}) };
    for (const field of fields) {
      if (!(field.key in suggestions)) continue;
      const normalized = normalizeAISuggestedFieldValue(field, suggestions[field.key]);
      if (normalized !== undefined) {
        metadata[field.key] = normalized;
      }
    }
    return { curriculumMetadata: metadata };
  }

  if (sectionKey === "resources") {
    const resourceData = generated as ResourceSuggestionsGenerated;
    const mergedTlms = Array.from(
      new Set(
        [...(note.tlms || []), ...(resourceData.tlms || [])]
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    const existingResources = note.resources || [];
    const seen = new Set(
      existingResources.map(
        (resource) =>
          `${resource.title.trim().toLowerCase()}::${(resource.type || "link").trim().toLowerCase()}`
      )
    );
    const mergedResources = [...existingResources];
    for (const resource of resourceData.resources || []) {
      const title = resource.title?.trim();
      if (!title) continue;
      const type = resource.type?.trim() || "link";
      const signature = `${title.toLowerCase()}::${type.toLowerCase()}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      mergedResources.push({
        title,
        type,
        url: resource.url?.trim() || "",
      } satisfies LessonNoteResource);
    }

    return {
      tlms: mergedTlms,
      resources: mergedResources,
    };
  }

  if (sectionKey === "body" && "body" in generated && generated.body && typeof generated.body === "object") {
    const formData = lessonNoteToFormData(note);
    return {
      body: applyGeneratedBody(formData.body, generated.body as Record<string, unknown>),
    };
  }

  if (sectionKey === "assessment") {
    const assessmentData = generated as AssessmentSectionGenerated;
    return {
      assessment: {
        ...(note.assessment || {}),
        inClassChecks: Array.isArray(assessmentData.inClassChecks)
          ? assessmentData.inClassChecks.filter((item): item is string => typeof item === "string")
          : note.assessment?.inClassChecks || [],
        exitTicket:
          typeof assessmentData.exitTicket === "string"
            ? assessmentData.exitTicket
            : note.assessment?.exitTicket,
        homework:
          typeof assessmentData.homework === "string"
            ? assessmentData.homework
            : note.assessment?.homework,
      },
      reflections: {
        ...(note.reflections || {}),
        learner:
          typeof assessmentData.learnerReflection === "string"
            ? assessmentData.learnerReflection
            : note.reflections?.learner,
        teacher:
          typeof assessmentData.teacherReflection === "string"
            ? assessmentData.teacherReflection
            : note.reflections?.teacher,
        nextLessonLink:
          typeof assessmentData.nextLessonLink === "string"
            ? assessmentData.nextLessonLink
            : note.reflections?.nextLessonLink,
      },
    };
  }

  if (sectionKey === "reflections") {
    const reflectionData = generated as AssessmentSectionGenerated;
    return {
      reflections: {
        ...(note.reflections || {}),
        learner:
          typeof reflectionData.learnerReflection === "string"
            ? reflectionData.learnerReflection
            : note.reflections?.learner,
        teacher:
          typeof reflectionData.teacherReflection === "string"
            ? reflectionData.teacherReflection
            : note.reflections?.teacher,
        nextLessonLink:
          typeof reflectionData.nextLessonLink === "string"
            ? reflectionData.nextLessonLink
            : note.reflections?.nextLessonLink,
      },
    };
  }

  const section = templateDefinition?.unitSections?.find((item) => item.key === sectionKey);
  if (section && "fieldSuggestions" in generated) {
    const suggestions = (generated as FieldSuggestionsGenerated).fieldSuggestions || {};
    const updates = { ...(note.unitPlannerData || {}) };
    for (const field of section.fields) {
      if (!(field.key in suggestions)) continue;
      const normalized = normalizeAISuggestedFieldValue(field, suggestions[field.key]);
      if (normalized !== undefined) {
        updates[field.key] = normalized;
      }
    }
    return { unitPlannerData: updates };
  }

  return null;
}

export function buildSectionPromptFromComments(
  sectionLabel: string,
  comments: LessonNoteReviewComment[]
) {
  const openComments = comments.filter((comment) => comment.status !== "resolved");
  if (!openComments.length) {
    return `Help me improve the ${sectionLabel.toLowerCase()} section.`;
  }

  return [
    `Help me update the ${sectionLabel.toLowerCase()} section based on these review comments:`,
    ...openComments.map((comment) => `- ${comment.comment}`),
  ].join("\n");
}
