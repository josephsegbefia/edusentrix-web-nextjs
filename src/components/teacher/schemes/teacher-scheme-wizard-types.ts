export type TeacherSchemeWizardStepId =
  | "overview"
  | "curriculum"
  | "plan"
  | "leo"
  | "coverage";

export const TEACHER_SCHEME_WIZARD_STEPS: Array<{ id: TeacherSchemeWizardStepId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "plan", label: "Weekly plan" },
  { id: "leo", label: "Leo assistant" },
  { id: "coverage", label: "Coverage" },
];
