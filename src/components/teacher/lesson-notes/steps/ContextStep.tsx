"use client";

import * as React from "react";
import { Calendar, Clock, BookOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { TemplatePicker } from "../TemplatePicker";
import { AIGenerateButton } from "../AIAssistant";
import type { LessonNoteFormData, LessonNoteTemplateType } from "@/types/lesson-notes";
import { getDefaultBodyForTemplate } from "@/types/lesson-notes";
import type { ClassOption } from "../LessonNoteWizard";
import type { NaCCA3PhaseGenerated, ClassicJHSGenerated, SimpleGenerated } from "@/hooks/teacher/useTeacherAIGenerate";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

type ContextStepProps = {
  formData: LessonNoteFormData;
  classOptions: ClassOption[];
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
  onTemplateChange: (templateType: LessonNoteTemplateType) => void;
  curriculumCode?: CurriculumCode;
  onAIGenerated?: (body: Record<string, unknown>, tlms?: string[]) => void;
};

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "35", label: "35 minutes" },
  { value: "40", label: "40 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "120 minutes" },
];

export function ContextStep({
  formData,
  classOptions,
  onUpdate,
  onTemplateChange,
  curriculumCode = "ghana_nacca",
  onAIGenerated,
}: ContextStepProps) {
  // Get subjects for selected class
  const selectedClass = classOptions.find((c) => c.id === formData.classGroupId);
  const subjects = selectedClass?.subjects || [];

  // When class changes, reset subject if not available
  React.useEffect(() => {
    if (formData.subjectId && !subjects.some((s) => s.id === formData.subjectId)) {
      onUpdate({ subjectId: subjects[0]?.id || undefined });
    }
  }, [formData.classGroupId, formData.subjectId, subjects, onUpdate]);

  // Handle AI generated content
  const handleAIGenerated = (data: NaCCA3PhaseGenerated | ClassicJHSGenerated | SimpleGenerated) => {
    const tlms = (data as { suggestedTLMs?: string[] }).suggestedTLMs;
    
    // Extract body based on template type
    if (formData.templateType === "NACCA_3_PHASE" && "starter" in data) {
      const body = {
        starter: data.starter,
        main: data.main,
        plenary: data.plenary,
      };
      onAIGenerated?.(body, tlms);
    } else if (formData.templateType === "CLASSIC_JHS" && "objectives" in data && "rpk" in data) {
      const body = {
        objectives: data.objectives,
        rpk: data.rpk,
        introduction: data.introduction,
        presentationSteps: data.presentationSteps,
        corePoints: data.corePoints,
        evaluation: data.evaluation,
        remarks: data.remarks,
      };
      onAIGenerated?.(body, tlms);
    } else if ("content" in data && "objectives" in data) {
      const body = {
        objectives: data.objectives,
        content: data.content,
      };
      onAIGenerated?.(body, tlms);
    }
  };

  // Get subject name for AI context
  const subjectName = subjects.find((s) => s.id === formData.subjectId)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Lesson Context</h2>
        <p className="text-sm text-white/60">
          Set the basic details for your lesson note
        </p>
      </div>

      {/* Class & Subject */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-white/70">Class *</Label>
          <PremiumSelect
            value={formData.classGroupId}
            onValueChange={(value) => onUpdate({ classGroupId: value })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select class" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {classOptions.map((option) => (
                <PremiumSelectItem key={option.id} value={option.id}>
                  {option.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>

        <div className="space-y-2">
          <Label className="text-white/70">Subject</Label>
          <PremiumSelect
            value={formData.subjectId || ""}
            onValueChange={(value) => onUpdate({ subjectId: value || undefined })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Select subject" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {subjects.map((subject) => (
                <PremiumSelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      {/* Topic */}
      <div className="space-y-2">
        <Label className="text-white/70">Topic *</Label>
        <div className="flex gap-2">
          <Input
            value={formData.topic}
            onChange={(e) => onUpdate({ topic: e.target.value })}
            placeholder="Enter lesson topic"
            className="flex-1 border-white/10 bg-white/5 text-white"
          />
          {onAIGenerated && (
            <AIGenerateButton
              context={{
                templateType: formData.templateType,
                topic: formData.topic,
                subject: subjectName,
                gradeLevel: selectedClass?.label,
                duration: formData.durationMinutes,
                strand: formData.curriculum?.strand,
                subStrand: formData.curriculum?.subStrand,
                contentStandard: formData.curriculum?.contentStandard,
                indicators: formData.curriculum?.indicators?.map((i) => i.text),
              }}
              onGenerated={handleAIGenerated}
              variant="compact"
            />
          )}
        </div>
        {onAIGenerated && (
          <p className="text-xs text-white/40">
            Enter a topic and click AI to generate lesson content automatically
          </p>
        )}
      </div>

      {/* Week & Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-white/70">
            <Calendar className="h-4 w-4" />
            Week of *
          </Label>
          <CustomDatePicker
            value={formData.weekOf}
            onChange={(date) => onUpdate({ weekOf: date || new Date() })}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-white/70">
            <Clock className="h-4 w-4" />
            Duration
          </Label>
          <PremiumSelect
            value={formData.durationMinutes?.toString() || "40"}
            onValueChange={(value) => onUpdate({ durationMinutes: parseInt(value, 10) })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Duration" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {DURATION_OPTIONS.map((option) => (
                <PremiumSelectItem key={option.value} value={option.value}>
                  {option.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      {/* Template Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-white/70">
          <BookOpen className="h-4 w-4" />
          Lesson Template *
        </Label>
        <TemplatePicker
          value={formData.templateType}
          onChange={onTemplateChange}
          curriculumCode={curriculumCode}
        />
      </div>

      {/* References (optional) */}
      <div className="space-y-2">
        <Label className="text-white/70">Reference (textbook, page)</Label>
        <Input
          value={formData.references[0] || ""}
          onChange={(e) => onUpdate({ references: [e.target.value].filter(Boolean) })}
          placeholder="e.g., Mathematics Textbook, Page 45-48"
          className="border-white/10 bg-white/5 text-white"
        />
      </div>
    </div>
  );
}
