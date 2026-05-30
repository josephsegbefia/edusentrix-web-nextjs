import { EXAM_TYPES } from "@/constants/academics/exam-scheduling-engine";
import type { ExamSessionDTO, ExamType } from "@/types/academics/exam-scheduling-engine";
import type { CreateExamSessionBodyInput } from "@/lib/exams/exam-session-service";

export const EXAM_SESSION_WIZARD_STEPS = [
  { id: 1, title: "Basic details", description: "Name, type, and dates" },
  { id: 2, title: "Classes", description: "Grades and class groups" },
  { id: 3, title: "Rules", description: "Visibility and notes" },
  { id: 4, title: "Review", description: "Confirm and create" },
] as const;

export const EXAM_TYPE_OPTIONS: Array<{ value: ExamType; label: string }> = [
  { value: "midterm", label: "Midterm" },
  { value: "end_of_term", label: "End of term" },
  { value: "mock", label: "Mock" },
  { value: "entrance", label: "Entrance" },
  { value: "class_test", label: "Class test" },
  { value: "other", label: "Other" },
];

export type ExamSessionWizardState = {
  name: string;
  code: string;
  examType: ExamType;
  academicPeriodId: string;
  startDate: string;
  endDate: string;
  appliesToGradeIds: string[];
  appliesToClassGroupIds: string[];
  allowParentStudentVisibility: boolean;
  notes: string;
};

export function createDefaultExamSessionWizardState(): ExamSessionWizardState {
  return {
    name: "",
    code: "",
    examType: "end_of_term",
    academicPeriodId: "",
    startDate: "",
    endDate: "",
    appliesToGradeIds: [],
    appliesToClassGroupIds: [],
    allowParentStudentVisibility: true,
    notes: "",
  };
}

export function sessionToWizardState(session: ExamSessionDTO): ExamSessionWizardState {
  return {
    name: session.name,
    code: session.code ?? "",
    examType: session.examType,
    academicPeriodId: session.academicPeriodId,
    startDate: session.startDate.slice(0, 10),
    endDate: session.endDate.slice(0, 10),
    appliesToGradeIds: session.appliesToGradeIds,
    appliesToClassGroupIds: session.appliesToClassGroupIds,
    allowParentStudentVisibility: session.allowParentStudentVisibility,
    notes: session.notes ?? "",
  };
}

export function validateExamSessionWizardStep(
  step: number,
  state: ExamSessionWizardState
): string | null {
  if (step === 1) {
    if (!state.name.trim()) return "Session name is required.";
    if (!state.academicPeriodId) return "Select an academic period.";
    if (!state.startDate) return "Start date is required.";
    if (!state.endDate) return "End date is required.";
    if (state.endDate < state.startDate) return "End date must be on or after start date.";
    if (!EXAM_TYPES.includes(state.examType)) return "Select a valid exam type.";
    return null;
  }

  if (step === 2) {
    if (state.appliesToGradeIds.length === 0 && state.appliesToClassGroupIds.length === 0) {
      return "Select at least one grade or class group.";
    }
    return null;
  }

  return null;
}

export function buildExamSessionPayload(state: ExamSessionWizardState): CreateExamSessionBodyInput {
  return {
    name: state.name.trim(),
    code: state.code.trim() ? state.code.trim() : null,
    examType: state.examType,
    academicPeriodId: state.academicPeriodId,
    startDate: state.startDate,
    endDate: state.endDate,
    appliesToGradeIds: state.appliesToGradeIds,
    appliesToClassGroupIds: state.appliesToClassGroupIds,
    allowParentStudentVisibility: state.allowParentStudentVisibility,
    notes: state.notes.trim() ? state.notes.trim() : null,
  };
}

export function formatExamType(value: ExamType) {
  return EXAM_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function formatExamSessionStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
