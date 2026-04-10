// Main wizard component
export { LessonNoteWizard, type ClassOption } from "./LessonNoteWizard";

// Template picker
export { TemplatePicker } from "./TemplatePicker";

// Quality indicators
export {
  QualityBadge,
  QualityRing,
  QualityChecklist,
  QualitySummary,
  MiniQualityIndicator,
} from "./QualityIndicator";

// Print / Export
export { PrintTemplate } from "./PrintTemplate";
export { PrintPreviewModal } from "./PrintPreviewModal";

// Approval workflow
export {
  ApprovalStatusBadge,
  SubmitForApprovalButton,
  ReturnToDraftButton,
  RejectionReasonAlert,
  ApprovalActionsPanel,
  ApprovalTimeline,
} from "./ApprovalWorkflow";

// AI Assistant
export {
  AISectionAssistant,
  AIQuickActions,
  AIExpandButton,
  AIGeneratedPreview,
  AISuggestedActivities,
} from "./AIAssistant";

// Draft / Offline indicators
export { DraftIndicator, DraftRecoveryPrompt } from "./DraftIndicator";

// Step components (used internally by wizard)
export { ContextStep } from "./steps/ContextStep";
export { CurriculumStep } from "./steps/CurriculumStep";
export { ResourcesStep } from "./steps/ResourcesStep";
export { BodyStep } from "./steps/BodyStep";
export { NaCCA3PhaseEditor } from "./steps/NaCCA3PhaseEditor";
export { ClassicJHSEditor } from "./steps/ClassicJHSEditor";
export { SimpleEditor } from "./steps/SimpleEditor";
export { AssessmentStep } from "./steps/AssessmentStep";
export { ReviewStep } from "./steps/ReviewStep";
export { DynamicPhaseEditor } from "./steps/DynamicPhaseEditor";
export { UnitPlannerSectionStep } from "./steps/UnitPlannerSectionStep";
