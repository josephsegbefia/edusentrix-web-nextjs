"use client";
import {
  type LessonNoteFormData,
  type NaCCA3PhaseBody,
  type ClassicJHSBody,
  type SimpleBody,
  isClassicJHSBody,
  isNaCCA3PhaseBody,
  isSimpleBody,
} from "@/types/lesson-notes";
import { summarizeLessonBodyForAI } from "@/lib/lesson-notes/ai-context";
import { sanitizeRichTextField } from "@/lib/lesson-notes/plain-text-content";
import { AISectionAssistant, type LessonNoteAIContext } from "../AIAssistant";
import { NaCCA3PhaseEditor } from "./NaCCA3PhaseEditor";
import { ClassicJHSEditor } from "./ClassicJHSEditor";
import { SimpleEditor } from "./SimpleEditor";
import { DynamicPhaseEditor } from "./DynamicPhaseEditor";

type BodyStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
  aiContext: LessonNoteAIContext;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeThreePhaseBody(
  current: NaCCA3PhaseBody,
  generated: Record<string, unknown>
): NaCCA3PhaseBody {
  return {
    ...current,
    ...(isRecord(generated) ? generated : {}),
    starter: {
      ...current.starter,
      ...(isRecord(generated.starter) ? generated.starter : {}),
    },
    main: {
      ...current.main,
      ...(isRecord(generated.main) ? generated.main : {}),
    },
    plenary: {
      ...current.plenary,
      ...(isRecord(generated.plenary) ? generated.plenary : {}),
    },
  };
}

function mergeClassicBody(
  current: ClassicJHSBody,
  generated: Record<string, unknown>
): ClassicJHSBody {
  const objectives = isRecord(generated.objectives) ? generated.objectives : null;
  const evaluation = isRecord(generated.evaluation) ? generated.evaluation : null;

  return {
    ...current,
    ...(isRecord(generated) ? generated : {}),
    objectives: {
      ...current.objectives,
      ...(objectives || {}),
      specific: Array.isArray(objectives?.specific)
        ? objectives.specific.filter((item): item is string => typeof item === "string")
        : current.objectives.specific,
    },
    presentationSteps: Array.isArray(generated.presentationSteps)
      ? generated.presentationSteps.filter((item): item is ClassicJHSBody["presentationSteps"][number] =>
          isRecord(item)
        )
      : current.presentationSteps,
    corePoints: Array.isArray(generated.corePoints)
      ? generated.corePoints.filter((item): item is string => typeof item === "string")
      : current.corePoints,
    evaluation: {
      ...current.evaluation,
      ...(evaluation || {}),
      questions: Array.isArray(evaluation?.questions)
        ? evaluation.questions.filter((item): item is string => typeof item === "string")
        : current.evaluation.questions,
      answers: Array.isArray(evaluation?.answers)
        ? evaluation.answers.filter((item): item is string => typeof item === "string")
        : current.evaluation.answers,
    },
  };
}

function mergeSimpleBody(
  current: SimpleBody,
  generated: Record<string, unknown>
): SimpleBody {
  return {
    ...current,
    ...(typeof generated.objectives === "string"
      ? { objectives: generated.objectives }
      : {}),
    ...(typeof generated.content === "string" ? { content: generated.content } : {}),
  };
}

function sanitizeBodyStrings(value: unknown): unknown {
  if (typeof value === "string") return sanitizeRichTextField(value);
  if (Array.isArray(value)) return value.map(sanitizeBodyStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        sanitizeBodyStrings(entry),
      ])
    );
  }
  return value;
}

function extractGeneratedBodyPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (isRecord(record.body)) return record.body;
  if (isRecord(record.starter) && isRecord(record.main) && isRecord(record.plenary)) {
    return record;
  }
  if (
    isRecord(record.objectives) ||
    typeof record.content === "string" ||
    typeof record.introduction === "string"
  ) {
    return record;
  }
  return null;
}

function applyGeneratedBody(
  current: LessonNoteFormData["body"],
  generated: Record<string, unknown>
): LessonNoteFormData["body"] {
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

export function BodyStep({ formData, onUpdate, aiContext }: BodyStepProps) {
  const assistant = (
    <AISectionAssistant
      context={aiContext}
      action="generate_body"
      section="Lesson Body"
      title="Draft This Teaching Flow"
      description="Ask AI to help with the teaching sequence for this tab only. Earlier tabs are used as context, but only the body gets updated."
      buttonLabel="Generate Body Ideas"
      existingContent={summarizeLessonBodyForAI(formData)}
      promptPlaceholder='What do you want help with on this section? e.g. "Make the main activity more interactive and suitable for mixed-ability learners."'
      onGenerated={(data) => {
        const generatedBody = extractGeneratedBodyPayload(data);
        if (!generatedBody) return;
        const sanitizedBody = sanitizeBodyStrings(generatedBody) as Record<string, unknown>;
        onUpdate({
          body: applyGeneratedBody(formData.body, sanitizedBody),
        });
      }}
    />
  );

  switch (formData.templateType) {
    case "NACCA_3_PHASE":
      return (
        <div className="space-y-6">
          {assistant}
          <NaCCA3PhaseEditor formData={formData} onUpdate={onUpdate} />
        </div>
      );

    case "CLASSIC_JHS":
      return (
        <div className="space-y-6">
          {assistant}
          <ClassicJHSEditor formData={formData} onUpdate={onUpdate} />
        </div>
      );

    case "CAMBRIDGE_3_PART":
    case "BRITISH_3_PART":
    case "AMERICAN_STANDARDS":
      return (
        <div className="space-y-6">
          {assistant}
          <DynamicPhaseEditor formData={formData} onUpdate={onUpdate} />
        </div>
      );

    case "IB_PYP_UNIT_PLANNER":
    case "IB_MYP_UNIT_PLANNER":
    case "SIMPLE":
    default:
      return (
        <div className="space-y-6">
          {assistant}
          <SimpleEditor formData={formData} onUpdate={onUpdate} />
        </div>
      );
  }
}
