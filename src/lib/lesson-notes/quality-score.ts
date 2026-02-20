/**
 * Lesson Note Quality Score Calculation
 *
 * Calculates completeness and quality scores for lesson notes
 * based on template type and filled fields.
 */

import { extractPlainText } from "@/components/ui/rich-text-editor";
import type {
  LessonNoteFormData,
  LessonNoteTemplateType,
  NaCCA3PhaseBody,
  ClassicJHSBody,
  SimpleBody,
} from "@/types/lesson-notes";
import {
  isNaCCA3PhaseBody,
  isClassicJHSBody,
  isSimpleBody,
} from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

export type QualityLevel = "excellent" | "good" | "fair" | "needs_work" | "incomplete";

export interface QualityCheckItem {
  id: string;
  label: string;
  category: "required" | "recommended" | "optional";
  passed: boolean;
  weight: number;
  message?: string;
}

export interface QualityScore {
  score: number; // 0-100
  level: QualityLevel;
  checks: QualityCheckItem[];
  summary: {
    passed: number;
    total: number;
    requiredPassed: number;
    requiredTotal: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function hasContent(value: string | undefined | null, minLength = 10): boolean {
  if (!value) return false;
  const plain = extractPlainText(value);
  return plain.trim().length >= minLength;
}

function hasMinItems(arr: unknown[] | undefined | null, min = 1): boolean {
  return Array.isArray(arr) && arr.length >= min;
}

function getQualityLevel(score: number): QualityLevel {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "needs_work";
  return "incomplete";
}

// ============================================================================
// NaCCA 3-Phase Quality Checks
// ============================================================================

function checkNaCCA3Phase(formData: LessonNoteFormData): QualityCheckItem[] {
  const body = formData.body as NaCCA3PhaseBody | undefined;
  const checks: QualityCheckItem[] = [];

  // Required checks
  checks.push({
    id: "topic",
    label: "Topic provided",
    category: "required",
    passed: hasContent(formData.topic, 3),
    weight: 10,
  });

  checks.push({
    id: "class",
    label: "Class selected",
    category: "required",
    passed: !!formData.classGroupId,
    weight: 10,
  });

  checks.push({
    id: "week",
    label: "Week selected",
    category: "required",
    passed: !!formData.weekOf,
    weight: 5,
  });

  // Starter phase
  checks.push({
    id: "starter_activities",
    label: "Starter activities described",
    category: "required",
    passed: hasContent(body?.starter?.activities, 20),
    weight: 10,
    message: "Describe what happens in the starter phase",
  });

  checks.push({
    id: "starter_rpk",
    label: "RPK prompt included",
    category: "recommended",
    passed: hasContent(body?.starter?.rpkPrompt, 10),
    weight: 5,
    message: "Review previous knowledge helps connect learning",
  });

  checks.push({
    id: "starter_hook",
    label: "Engagement hook provided",
    category: "recommended",
    passed: hasContent(body?.starter?.engagementHook, 10),
    weight: 5,
  });

  // Main phase
  checks.push({
    id: "main_teacher",
    label: "Teacher activities described",
    category: "required",
    passed: hasContent(body?.main?.teacherActivities, 30),
    weight: 15,
    message: "Describe what the teacher does during the main activity",
  });

  checks.push({
    id: "main_learner",
    label: "Learner activities described",
    category: "required",
    passed: hasContent(body?.main?.learnerActivities, 30),
    weight: 15,
    message: "Describe what learners do during the main activity",
  });

  checks.push({
    id: "main_assessment",
    label: "Embedded assessment included",
    category: "recommended",
    passed: hasContent(body?.main?.embeddedAssessment, 10),
    weight: 5,
  });

  checks.push({
    id: "main_differentiation",
    label: "Differentiation strategies",
    category: "optional",
    passed: hasContent(body?.main?.differentiation, 10),
    weight: 3,
  });

  // Plenary phase
  checks.push({
    id: "plenary_summary",
    label: "Summary points provided",
    category: "required",
    passed: hasContent(body?.plenary?.summaryPoints, 15),
    weight: 10,
    message: "Include key points to consolidate learning",
  });

  checks.push({
    id: "plenary_reflection",
    label: "Learner reflection prompt",
    category: "recommended",
    passed: hasContent(body?.plenary?.learnerReflection, 10),
    weight: 5,
  });

  // Curriculum alignment
  checks.push({
    id: "curriculum_strand",
    label: "Curriculum strand specified",
    category: "recommended",
    passed: !!(formData.curriculum?.strand && formData.curriculum.strand.trim().length > 0),
    weight: 3,
  });

  checks.push({
    id: "curriculum_indicators",
    label: "Curriculum indicators linked",
    category: "recommended",
    passed: hasMinItems(formData.curriculum?.indicators),
    weight: 5,
  });

  checks.push({
    id: "learning_outcomes",
    label: "Learning outcomes defined",
    category: "recommended",
    passed: hasMinItems(formData.curriculum?.learningOutcomes),
    weight: 5,
  });

  // Resources
  checks.push({
    id: "tlms",
    label: "TLMs selected",
    category: "recommended",
    passed: hasMinItems(formData.tlms),
    weight: 3,
  });

  return checks;
}

// ============================================================================
// Classic JHS Quality Checks
// ============================================================================

function checkClassicJHS(formData: LessonNoteFormData): QualityCheckItem[] {
  const body = formData.body as ClassicJHSBody | undefined;
  const checks: QualityCheckItem[] = [];

  // Required checks
  checks.push({
    id: "topic",
    label: "Topic provided",
    category: "required",
    passed: hasContent(formData.topic, 3),
    weight: 10,
  });

  checks.push({
    id: "class",
    label: "Class selected",
    category: "required",
    passed: !!formData.classGroupId,
    weight: 10,
  });

  checks.push({
    id: "week",
    label: "Week selected",
    category: "required",
    passed: !!formData.weekOf,
    weight: 5,
  });

  // Objectives
  checks.push({
    id: "general_objective",
    label: "General objective stated",
    category: "required",
    passed: hasContent(body?.objectives?.general, 20),
    weight: 10,
    message: "State what learners will achieve by end of lesson",
  });

  checks.push({
    id: "specific_objectives",
    label: "Specific objectives (2+)",
    category: "required",
    passed:
      hasMinItems(body?.objectives?.specific, 2) &&
      body!.objectives.specific.filter((s) => hasContent(s, 10)).length >= 2,
    weight: 10,
    message: "Include at least 2 measurable specific objectives",
  });

  // RPK & Introduction
  checks.push({
    id: "rpk",
    label: "RPK described",
    category: "required",
    passed: hasContent(body?.rpk, 15),
    weight: 8,
  });

  checks.push({
    id: "introduction",
    label: "Introduction provided",
    category: "recommended",
    passed: hasContent(body?.introduction, 15),
    weight: 5,
  });

  // Presentation steps
  checks.push({
    id: "presentation_steps",
    label: "Presentation steps (2+)",
    category: "required",
    passed: hasMinItems(body?.presentationSteps, 2),
    weight: 15,
    message: "Include at least 2 presentation steps",
  });

  const stepsWithContent =
    body?.presentationSteps?.filter(
      (step) =>
        hasContent(step.teacherActivity, 15) && hasContent(step.learnerActivity, 15)
    ).length || 0;

  checks.push({
    id: "steps_detailed",
    label: "Steps have teacher & learner activities",
    category: "required",
    passed: stepsWithContent >= 2,
    weight: 10,
  });

  // Core points
  checks.push({
    id: "core_points",
    label: "Core points listed",
    category: "recommended",
    passed:
      hasMinItems(body?.corePoints, 2) &&
      body!.corePoints.filter((p) => hasContent(p, 5)).length >= 2,
    weight: 5,
  });

  // Evaluation
  checks.push({
    id: "evaluation_questions",
    label: "Evaluation questions (2+)",
    category: "required",
    passed:
      hasMinItems(body?.evaluation?.questions, 2) &&
      body!.evaluation.questions.filter((q) => hasContent(q, 10)).length >= 2,
    weight: 10,
    message: "Include at least 2 evaluation questions",
  });

  // Remarks
  checks.push({
    id: "remarks",
    label: "Remarks section filled",
    category: "optional",
    passed: hasContent(body?.remarks, 10),
    weight: 3,
  });

  // Curriculum alignment
  checks.push({
    id: "curriculum_strand",
    label: "Curriculum strand specified",
    category: "recommended",
    passed: !!(formData.curriculum?.strand && formData.curriculum.strand.trim().length > 0),
    weight: 3,
  });

  checks.push({
    id: "tlms",
    label: "TLMs selected",
    category: "recommended",
    passed: hasMinItems(formData.tlms),
    weight: 3,
  });

  return checks;
}

// ============================================================================
// Simple/Quick Note Quality Checks
// ============================================================================

function checkSimple(formData: LessonNoteFormData): QualityCheckItem[] {
  const body = formData.body as SimpleBody | undefined;
  const checks: QualityCheckItem[] = [];

  // Required checks
  checks.push({
    id: "topic",
    label: "Topic provided",
    category: "required",
    passed: hasContent(formData.topic, 3),
    weight: 15,
  });

  checks.push({
    id: "class",
    label: "Class selected",
    category: "required",
    passed: !!formData.classGroupId,
    weight: 15,
  });

  checks.push({
    id: "week",
    label: "Week selected",
    category: "required",
    passed: !!formData.weekOf,
    weight: 10,
  });

  checks.push({
    id: "objectives",
    label: "Objectives described",
    category: "required",
    passed: hasContent(body?.objectives, 20),
    weight: 20,
    message: "Describe what learners will achieve",
  });

  checks.push({
    id: "content",
    label: "Lesson content provided",
    category: "required",
    passed: hasContent(body?.content, 50),
    weight: 25,
    message: "Describe the lesson activities and content",
  });

  // Optional
  checks.push({
    id: "curriculum_strand",
    label: "Curriculum strand specified",
    category: "optional",
    passed: !!(formData.curriculum?.strand && formData.curriculum.strand.trim().length > 0),
    weight: 5,
  });

  checks.push({
    id: "tlms",
    label: "TLMs selected",
    category: "optional",
    passed: hasMinItems(formData.tlms),
    weight: 5,
  });

  checks.push({
    id: "resources",
    label: "External resources added",
    category: "optional",
    passed: hasMinItems(formData.resources),
    weight: 5,
  });

  return checks;
}

// ============================================================================
// Main Calculator
// ============================================================================

export function calculateQualityScore(formData: LessonNoteFormData): QualityScore {
  let checks: QualityCheckItem[];

  // Get template-specific checks
  if (formData.templateType === "NACCA_3_PHASE" && isNaCCA3PhaseBody(formData.body)) {
    checks = checkNaCCA3Phase(formData);
  } else if (formData.templateType === "CLASSIC_JHS" && isClassicJHSBody(formData.body)) {
    checks = checkClassicJHS(formData);
  } else {
    checks = checkSimple(formData);
  }

  // Calculate score
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks
    .filter((c) => c.passed)
    .reduce((sum, c) => sum + c.weight, 0);

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  // Count passed/total
  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const requiredChecks = checks.filter((c) => c.category === "required");
  const requiredPassed = requiredChecks.filter((c) => c.passed).length;
  const requiredTotal = requiredChecks.length;

  return {
    score,
    level: getQualityLevel(score),
    checks,
    summary: {
      passed,
      total,
      requiredPassed,
      requiredTotal,
    },
  };
}

// ============================================================================
// Level Labels and Colors
// ============================================================================

export const QUALITY_LEVEL_CONFIG: Record<
  QualityLevel,
  { label: string; color: string; bgColor: string; emoji: string }
> = {
  excellent: {
    label: "Excellent",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    emoji: "✨",
  },
  good: {
    label: "Good",
    color: "text-green-300",
    bgColor: "bg-green-500/20",
    emoji: "👍",
  },
  fair: {
    label: "Fair",
    color: "text-amber-300",
    bgColor: "bg-amber-500/20",
    emoji: "📝",
  },
  needs_work: {
    label: "Needs Work",
    color: "text-orange-300",
    bgColor: "bg-orange-500/20",
    emoji: "⚠️",
  },
  incomplete: {
    label: "Incomplete",
    color: "text-rose-300",
    bgColor: "bg-rose-500/20",
    emoji: "❌",
  },
};

export const CATEGORY_CONFIG = {
  required: {
    label: "Required",
    color: "text-rose-300",
    bgColor: "bg-rose-500/20",
  },
  recommended: {
    label: "Recommended",
    color: "text-amber-300",
    bgColor: "bg-amber-500/20",
  },
  optional: {
    label: "Optional",
    color: "text-white/50",
    bgColor: "bg-white/10",
  },
};

// ============================================================================
// Check ID to Wizard Step Mapping
// ============================================================================

export type WizardStep = "context" | "curriculum" | "resources" | "body" | "assessment" | "review";

export const CHECK_STEP_MAPPING: Record<string, { step: WizardStep; section?: string }> = {
  // Context step
  topic: { step: "context" },
  class: { step: "context" },
  week: { step: "context" },
  
  // Curriculum step
  curriculum_strand: { step: "curriculum", section: "strand" },
  curriculum_indicators: { step: "curriculum", section: "indicators" },
  learning_outcomes: { step: "curriculum", section: "outcomes" },
  
  // Resources step
  tlms: { step: "resources", section: "tlms" },
  resources: { step: "resources", section: "external" },
  
  // Body step - NaCCA
  starter_activities: { step: "body", section: "starter" },
  starter_rpk: { step: "body", section: "starter" },
  starter_hook: { step: "body", section: "starter" },
  main_teacher: { step: "body", section: "main" },
  main_learner: { step: "body", section: "main" },
  main_assessment: { step: "body", section: "main" },
  main_differentiation: { step: "body", section: "main" },
  plenary_summary: { step: "body", section: "plenary" },
  plenary_reflection: { step: "body", section: "plenary" },
  
  // Body step - Classic JHS
  general_objective: { step: "body", section: "objectives" },
  specific_objectives: { step: "body", section: "objectives" },
  rpk: { step: "body", section: "rpk" },
  introduction: { step: "body", section: "introduction" },
  presentation_steps: { step: "body", section: "steps" },
  steps_detailed: { step: "body", section: "steps" },
  core_points: { step: "body", section: "core_points" },
  evaluation_questions: { step: "body", section: "evaluation" },
  remarks: { step: "body", section: "remarks" },
  
  // Body step - Simple
  objectives: { step: "body", section: "objectives" },
  content: { step: "body", section: "content" },
  
  // Assessment step
  in_class_checks: { step: "assessment", section: "checks" },
  exit_ticket: { step: "assessment", section: "exit_ticket" },
  homework: { step: "assessment", section: "homework" },
};

export function getStepForCheck(checkId: string): { step: WizardStep; section?: string } | null {
  return CHECK_STEP_MAPPING[checkId] || null;
}
