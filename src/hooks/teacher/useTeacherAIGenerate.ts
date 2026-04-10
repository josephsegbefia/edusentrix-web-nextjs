import { useMutation } from "@tanstack/react-query";
import type { LessonNoteTemplateType } from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

export type AIGenerateAction =
  | "refine_context"
  | "suggest_field_values"
  | "suggest_resources"
  | "generate_body"
  | "generate_assessment_section"
  | "expand_section"
  | "suggest_activities"
  | "improve_content"
  | "generate_assessment"
  | "generate_objectives";

export interface AIFieldBlueprint {
  key: string;
  label: string;
  type:
    | "text"
    | "richtext"
    | "indicator_list"
    | "outcome_list"
    | "tag_list"
    | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface AIGenerateRequest {
  action: AIGenerateAction;
  templateType: LessonNoteTemplateType;
  topic: string;
  subject?: string;
  gradeLevel?: string;
  duration?: number;
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators?: string[];
  section?: string;
  existingContent?: string;
  learnerBackground?: string;
  classSize?: number;
  teacherIntent?: string;
  contextSummary?: string;
  fieldBlueprint?: AIFieldBlueprint[];
}

// Response types for different actions
export interface NaCCA3PhaseGenerated {
  starter: {
    activities: string;
    rpkPrompt?: string;
    engagementHook?: string;
    timeMins?: number;
  };
  main: {
    teacherActivities: string;
    learnerActivities: string;
    resourcesUsed?: string;
    embeddedAssessment?: string;
    differentiation?: string;
    groupingStrategy?: string;
    timeMins?: number;
  };
  plenary: {
    summaryPoints: string;
    learnerReflection?: string;
    teacherReflection?: string;
    exitTicket?: string;
    homework?: string;
    timeMins?: number;
  };
  suggestedTLMs?: string[];
  suggestedObjectives?: string[];
}

export interface RefinedContextGenerated {
  topic: string;
  reference?: string;
  durationMinutes?: number;
  rationale?: string;
}

export interface FieldSuggestionsGenerated {
  fieldSuggestions: Record<string, unknown>;
}

export interface ResourceSuggestionsGenerated {
  tlms?: string[];
  resources?: Array<{
    title: string;
    type?: string;
    url?: string;
  }>;
}

export interface GeneratedBodyResponse {
  body: Record<string, unknown>;
}

export interface AssessmentSectionGenerated {
  inClassChecks?: string[];
  exitTicket?: string;
  homework?: string;
  learnerReflection?: string;
  teacherReflection?: string;
  nextLessonLink?: string;
}

export interface ClassicJHSGenerated {
  objectives: {
    general: string;
    specific: string[];
  };
  rpk: string;
  introduction: string;
  presentationSteps: Array<{
    stepTitle: string;
    teacherActivity: string;
    learnerActivity: string;
    boardWork?: string;
    keyQuestions?: string[];
    timeMins?: number;
  }>;
  corePoints: string[];
  evaluation: {
    questions: string[];
    answers?: string[];
    markingNotes?: string;
  };
  remarks?: string;
  suggestedTLMs?: string[];
}

export interface SimpleGenerated {
  objectives: string;
  content: string;
  suggestedTLMs?: string[];
}

export interface ExpandedContent {
  expandedContent: string;
  suggestions?: string[];
}

export interface ActivitySuggestions {
  activities: Array<{
    name: string;
    description: string;
    duration: string;
    materials: string[];
    groupSize: string;
    objectives: string;
  }>;
}

export interface AssessmentGenerated {
  exitTicket?: string;
  evaluationQuestions: Array<{
    question: string;
    type: string;
    answer: string;
    difficulty: string;
  }>;
  homeworkSuggestions?: string[];
  embeddedChecks?: string[];
}

export interface ObjectivesGenerated {
  generalObjective: string;
  specificObjectives: string[];
  learningOutcomes?: string[];
}

export interface ImprovedContent {
  improvedContent: string;
  changes?: string[];
  suggestions?: string[];
}

export type AIGenerateResponse = 
  | RefinedContextGenerated
  | FieldSuggestionsGenerated
  | ResourceSuggestionsGenerated
  | GeneratedBodyResponse
  | AssessmentSectionGenerated
  | NaCCA3PhaseGenerated
  | ClassicJHSGenerated
  | SimpleGenerated
  | ExpandedContent
  | ActivitySuggestions
  | AssessmentGenerated
  | ObjectivesGenerated
  | ImprovedContent;

export interface AIGenerateResult {
  success: boolean;
  data?: AIGenerateResponse;
  error?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ============================================================================
// useAIGenerate - Main hook for AI generation
// ============================================================================

export function useAIGenerate() {
  return useMutation<AIGenerateResult, Error, AIGenerateRequest>({
    mutationFn: async (request) => {
      const res = await fetch("/api/teacher/lesson-notes/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "AI generation failed");
      }
      return data;
    },
  });
}

// ============================================================================
// Convenience hooks for specific actions
// ============================================================================

export function useExpandSection() {
  const mutation = useAIGenerate();

  return {
    ...mutation,
    expand: (params: Omit<AIGenerateRequest, "action">) =>
      mutation.mutateAsync({ ...params, action: "expand_section" }),
  };
}

export function useSuggestActivities() {
  const mutation = useAIGenerate();

  return {
    ...mutation,
    suggest: (params: Omit<AIGenerateRequest, "action">) =>
      mutation.mutateAsync({ ...params, action: "suggest_activities" }),
  };
}

export function useGenerateAssessment() {
  const mutation = useAIGenerate();

  return {
    ...mutation,
    generate: (params: Omit<AIGenerateRequest, "action">) =>
      mutation.mutateAsync({ ...params, action: "generate_assessment" }),
  };
}

export function useGenerateObjectives() {
  const mutation = useAIGenerate();

  return {
    ...mutation,
    generate: (params: Omit<AIGenerateRequest, "action">) =>
      mutation.mutateAsync({ ...params, action: "generate_objectives" }),
  };
}

export function useImproveContent() {
  const mutation = useAIGenerate();

  return {
    ...mutation,
    improve: (params: Omit<AIGenerateRequest, "action">) =>
      mutation.mutateAsync({ ...params, action: "improve_content" }),
  };
}
