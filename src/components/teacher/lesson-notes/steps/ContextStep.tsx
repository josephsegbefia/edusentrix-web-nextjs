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
import { AISectionAssistant, type LessonNoteAIContext } from "../AIAssistant";
import type { LessonNoteFormData, LessonNoteTemplateType } from "@/types/lesson-notes";
import type { ClassOption } from "../LessonNoteWizard";
import type { RefinedContextGenerated } from "@/hooks/teacher/useTeacherAIGenerate";
import type { CurriculumCode } from "@/constants/curriculum-profiles";
import { LessonNoteSchemeLinkPanel } from "../LessonNoteSchemeLinkPanel";

type ContextStepProps = {
  formData: LessonNoteFormData;
  classOptions: ClassOption[];
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
  onTemplateChange: (templateType: LessonNoteTemplateType) => void;
  curriculumCode?: CurriculumCode;
  aiContext: LessonNoteAIContext;
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

function formatDateLabel(value?: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ContextStep({
  formData,
  classOptions,
  onUpdate,
  onTemplateChange,
  curriculumCode = "ghana_nacca",
  aiContext,
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

      <LessonNoteSchemeLinkPanel formData={formData} onUpdate={onUpdate} />

      {formData.weekEndingDate ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-medium">Scheme week ending:</span>{" "}
          {formatDateLabel(formData.weekEndingDate)}
        </div>
      ) : null}

      {/* Topic */}
      <div className="space-y-2">
        <Label className="text-white/70">Topic *</Label>
        <Input
          value={formData.topic}
          onChange={(e) => onUpdate({ topic: e.target.value })}
          placeholder="Enter lesson topic"
          className="border-white/10 bg-white/5 text-white"
        />
      </div>

      <AISectionAssistant
        context={aiContext}
        action="refine_context"
        section="Context"
        title="Shape This Lesson Context"
        description="Use AI to tighten the topic, suggest a reference, and refine the lesson timing without touching later tabs."
        buttonLabel="Refine Context"
        existingContent={[
          formData.topic && `Topic: ${formData.topic}`,
          formData.references[0] && `Reference: ${formData.references[0]}`,
          formData.durationMinutes && `Duration: ${formData.durationMinutes} minutes`,
        ]
          .filter(Boolean)
          .join("\n")}
        promptPlaceholder='What do you want help with on this section? e.g. "Make the topic clearer for Basic 4 and suggest a strong textbook reference."'
        onGenerated={(data) => {
          if (!("topic" in data)) {
            return;
          }
          const generated = data as RefinedContextGenerated;
          onUpdate({
            topic: generated.topic || formData.topic,
            references:
              generated.reference?.trim()
                ? [generated.reference.trim()]
                : formData.references,
            durationMinutes:
              typeof generated.durationMinutes === "number" &&
              Number.isFinite(generated.durationMinutes)
                ? generated.durationMinutes
                : formData.durationMinutes,
          });
        }}
      />

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
