"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Save, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useTeacherLessonNoteCreate } from "@/hooks/teacher/useTeacherLessonNoteCreate";
import { useTeacherLessonNoteUpdate } from "@/hooks/teacher/useTeacherLessonNoteUpdate";
import {
  type LessonNoteFormData,
  type LessonNoteTemplateType,
  type WizardStep,
  DEFAULT_FORM_DATA,
  getDefaultBodyForTemplate,
} from "@/types/lesson-notes";
import { calculateQualityScore } from "@/lib/lesson-notes/quality-score";
import { buildLessonNoteAIContextSummary } from "@/lib/lesson-notes/ai-context";
import { MiniQualityIndicator } from "./QualityIndicator";
import { PrintPreviewModal } from "./PrintPreviewModal";
import {
  ApprovalStatusBadge,
  SubmitForApprovalButton,
  ReturnToDraftButton,
  RejectionReasonAlert,
} from "./ApprovalWorkflow";

import { ContextStep } from "./steps/ContextStep";
import { CurriculumStep } from "./steps/CurriculumStep";
import { ResourcesStep } from "./steps/ResourcesStep";
import { BodyStep } from "./steps/BodyStep";
import { AssessmentStep } from "./steps/AssessmentStep";
import { ReviewStep } from "./steps/ReviewStep";
import { UnitPlannerSectionStep } from "./steps/UnitPlannerSectionStep";

import type { CurriculumCode } from "@/constants/curriculum-profiles";
import { getTemplateDefinition, getDefaultTemplate } from "@/constants/curriculum-lesson-templates";

// ============================================================================
// Types
// ============================================================================

export type ClassOption = {
  id: string;
  label: string;
  subjects: Array<{ id: string; name: string }>;
};

type LessonNoteWizardProps = {
  classOptions: ClassOption[];
  initialData?: Partial<LessonNoteFormData> & { id?: string; status?: string; rejectionReason?: string };
  onComplete?: () => void;
  onCancel?: () => void;
  schoolName?: string;
  schoolLogo?: string;
  teacherName?: string;
  curriculumCode?: CurriculumCode;
};

// ============================================================================
// Component
// ============================================================================

export function LessonNoteWizard({
  classOptions,
  initialData,
  onComplete,
  onCancel,
  schoolName,
  schoolLogo,
  teacherName,
  curriculumCode = "ghana_nacca",
}: LessonNoteWizardProps) {
  const busyToast = useBusyToast();
  const createMutation = useTeacherLessonNoteCreate();
  const updateMutation = useTeacherLessonNoteUpdate();

  const isEditing = !!initialData?.id;
  const currentStatus = (initialData?.status as "draft" | "submitted" | "approved" | "rejected" | "published") || "draft";
  const rejectionReason = initialData?.rejectionReason || null;

  // Print preview state
  const [showPrintPreview, setShowPrintPreview] = React.useState(false);

  // Form state
  const defaultTemplate = getDefaultTemplate(curriculumCode);
  const [formData, setFormData] = React.useState<LessonNoteFormData>(() => ({
    ...DEFAULT_FORM_DATA,
    classGroupId: initialData?.classGroupId || classOptions[0]?.id || "",
    templateType: initialData?.templateType || defaultTemplate.id,
    curriculumCode,
    ...initialData,
  }));

  // Derive wizard steps from the selected template
  const templateDef = getTemplateDefinition(formData.templateType);
  const wizardStepDefs = templateDef?.wizardSteps || defaultTemplate.wizardSteps;
  const stepIds = wizardStepDefs.map((s) => s.id) as WizardStep[];
  const selectedClass = classOptions.find((option) => option.id === formData.classGroupId);
  const selectedSubjectName =
    selectedClass?.subjects.find((subject) => subject.id === formData.subjectId)?.name;

  // Current step
  const [currentStep, setCurrentStep] = React.useState<WizardStep>("context");
  const currentStepIndex = stepIds.indexOf(currentStep);

  // If current step is not in the new step list (after template change), reset to context
  React.useEffect(() => {
    if (!stepIds.includes(currentStep)) {
      setCurrentStep("context");
    }
  }, [stepIds, currentStep]);

  // Track completed steps
  const [completedSteps, setCompletedSteps] = React.useState<Set<WizardStep>>(new Set());

  // Update form data
  const updateForm = React.useCallback((updates: Partial<LessonNoteFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Handle template change - reset body and curriculum metadata to appropriate defaults
  const handleTemplateChange = React.useCallback((templateType: LessonNoteTemplateType) => {
    setFormData((prev) => ({
      ...prev,
      templateType,
      body: getDefaultBodyForTemplate(templateType),
      curriculumCode,
      curriculumMetadata: {},
      unitPlannerData: {},
    }));
  }, [curriculumCode]);

  // Step navigation
  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepIds.length) {
      setCurrentStep(stepIds[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepIds[prevIndex]);
    }
  };

  // Validation per step
  const validateStep = (step: WizardStep): { valid: boolean; message?: string } => {
    switch (step) {
      case "context":
        if (!formData.classGroupId) return { valid: false, message: "Select a class" };
        if (!formData.topic.trim()) return { valid: false, message: "Enter a topic" };
        if (!formData.weekOf) return { valid: false, message: "Select a week" };
        return { valid: true };

      case "curriculum":
        // Curriculum is optional but encouraged
        return { valid: true };

      case "resources":
        // Resources are optional
        return { valid: true };

      case "body":
        // Body should have some content
        if (!formData.body) return { valid: false, message: "Add lesson content" };
        return { valid: true };

      case "assessment":
        // Assessment is optional
        return { valid: true };

      case "review":
        return { valid: true };

      default:
        return { valid: true };
    }
  };

  const currentValidation = validateStep(currentStep);
  const canProceed = currentValidation.valid;

  // Calculate quality score
  const qualityScore = React.useMemo(
    () => calculateQualityScore(formData),
    [formData]
  );

  // Save handlers
  const handleSave = async (status: "draft" | "published" = "draft") => {
    // Validate required fields
    const contextValidation = validateStep("context");
    if (!contextValidation.valid) {
      busyToast.warning(contextValidation.message || "Please complete required fields");
      setCurrentStep("context");
      return;
    }

    const payload = {
      ...formData,
      weekOf: formData.weekOf.toISOString(),
      date: formData.date?.toISOString(),
      status,
    };

    try {
      if (isEditing && initialData?.id) {
        await busyToast.promise(
          updateMutation.mutateAsync({ id: initialData.id, ...payload }),
          {
            loading: "Updating lesson note...",
            success: "Lesson note updated!",
            error: "Failed to update",
          }
        );
      } else {
        await busyToast.promise(createMutation.mutateAsync(payload), {
          loading: "Saving lesson note...",
          success: "Lesson note saved!",
          error: "Failed to save",
        });
      }
      onComplete?.();
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  const buildAIContext = React.useCallback(
    (stepId: string) => ({
      templateType: formData.templateType,
      topic: formData.topic,
      subject: selectedSubjectName,
      gradeLevel: selectedClass?.label,
      duration: formData.durationMinutes,
      strand: formData.curriculum?.strand,
      subStrand: formData.curriculum?.subStrand,
      contentStandard: formData.curriculum?.contentStandard,
      indicators: formData.curriculum?.indicators
        ?.map((indicator) => indicator.text)
        .filter(Boolean),
      contextSummary: buildLessonNoteAIContextSummary({
        formData,
        classOptions,
        stepIds,
        currentStep: stepId,
        unitSections: templateDef?.unitSections,
      }),
    }),
    [classOptions, formData, selectedClass?.label, selectedSubjectName, stepIds, templateDef?.unitSections]
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case "context":
        return (
          <ContextStep
            formData={formData}
            classOptions={classOptions}
            onUpdate={updateForm}
            onTemplateChange={handleTemplateChange}
            curriculumCode={curriculumCode}
            aiContext={buildAIContext("context")}
          />
        );

      case "curriculum":
        return (
          <CurriculumStep
            formData={formData}
            onUpdate={updateForm}
            aiContext={buildAIContext("curriculum")}
          />
        );

      case "resources": {
        const resourceSection = templateDef?.unitSections?.find((s) => s.key === "resources");
        if (resourceSection) {
          return (
            <UnitPlannerSectionStep
              section={resourceSection}
              data={formData.unitPlannerData || {}}
              onUpdate={(updates) => {
                updateForm({ unitPlannerData: { ...formData.unitPlannerData, ...updates } });
              }}
              aiContext={buildAIContext("resources")}
            />
          );
        }
        return (
          <ResourcesStep
            formData={formData}
            onUpdate={updateForm}
            aiContext={buildAIContext("resources")}
          />
        );
      }

      case "body":
        return (
          <BodyStep
            formData={formData}
            onUpdate={updateForm}
            aiContext={buildAIContext("body")}
          />
        );

      case "assessment":
        return (
          <AssessmentStep
            formData={formData}
            onUpdate={updateForm}
            aiContext={buildAIContext("assessment")}
          />
        );

      case "review":
        return (
          <ReviewStep
            formData={formData}
            classOptions={classOptions}
            onEdit={goToStep}
          />
        );

      default: {
        // Handle IB unit planner section steps dynamically
        const section = templateDef?.unitSections?.find((s) => s.key === currentStep);
        if (section) {
          return (
            <UnitPlannerSectionStep
              section={section}
              data={formData.unitPlannerData || {}}
              onUpdate={(updates) => {
                updateForm({
                  unitPlannerData: { ...formData.unitPlannerData, ...updates },
                });
              }}
              aiContext={buildAIContext(section.key)}
            />
          );
        }
        return null;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Rejection reason alert */}
      {currentStatus === "rejected" && rejectionReason && (
        <RejectionReasonAlert reason={rejectionReason} />
      )}

      {/* Quality indicator & Step indicator */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MiniQualityIndicator score={qualityScore} />
          {isEditing && currentStatus !== "draft" && (
            <ApprovalStatusBadge status={currentStatus} size="sm" />
          )}
        </div>
        <div className="flex items-center justify-center gap-2 flex-1">
        {wizardStepDefs.map((step, index) => {
          const stepId = step.id as WizardStep;
          const isCompleted = completedSteps.has(stepId);
          const isCurrent = currentStep === stepId;
          const isPast = index < currentStepIndex;

          return (
            <React.Fragment key={stepId}>
              {index > 0 && (
                <div
                  className={cn(
                    "h-px w-8 transition-colors",
                    isPast || isCompleted ? "bg-emerald-500" : "bg-white/10"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => goToStep(stepId)}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : isCompleted || isPast
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
        </div>
      </div>

      {/* Step content */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentStepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {/* Print preview button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPrintPreview(true)}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Printer className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>

          {/* Save draft button (always available) */}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave("draft")}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Save className="mr-1 h-4 w-4" />
            Save Draft
          </Button>

          {currentStep === "review" ? (
            <>
              {/* Return to Draft button for submitted/rejected notes */}
              {isEditing && initialData?.id && (
                <ReturnToDraftButton
                  noteId={initialData.id}
                  currentStatus={currentStatus}
                  onSuccess={onComplete}
                />
              )}

              {/* Submit for Approval button for draft/rejected notes */}
              {isEditing && initialData?.id && (
                <SubmitForApprovalButton
                  noteId={initialData.id}
                  currentStatus={currentStatus}
                  onSuccess={onComplete}
                />
              )}

              {/* Publish button */}
              <Button
                type="button"
                onClick={() => handleSave("published")}
                className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              >
                <Check className="mr-1 h-4 w-4" />
                Publish
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Validation message */}
      {!canProceed && currentValidation.message && (
        <p className="text-center text-sm text-amber-400/80">
          {currentValidation.message}
        </p>
      )}

      {/* Print Preview Modal */}
      <PrintPreviewModal
        open={showPrintPreview}
        onOpenChange={setShowPrintPreview}
        formData={formData}
        className={
          selectedClass?.label
        }
        subjectName={selectedSubjectName}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        teacherName={teacherName}
      />
    </div>
  );
}
