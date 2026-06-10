"use client";

import * as React from "react";
import { Calendar, Clock, BookOpen, Info } from "lucide-react";
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
import type {
  LessonNoteFormData,
  LessonNotePeriodPlanningContext,
  LessonNoteTemplateType,
} from "@/types/lesson-notes";
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
  periodPlanningContext?: LessonNotePeriodPlanningContext | null;
};

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes (one period)" },
  { value: "35", label: "35 minutes (one period)" },
  { value: "40", label: "40 minutes (one period)" },
  { value: "45", label: "45 minutes (one period)" },
  { value: "60", label: "60 minutes (double period)" },
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

function formatDateRangeLabel(start?: Date | null, end?: Date | null) {
  const startLabel = formatDateLabel(start);
  const endLabel = formatDateLabel(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel || endLabel;
}

function SchemeWeekPlanningCallout({
  formData,
  periodPlanningContext,
  subjectName,
}: {
  formData: LessonNoteFormData;
  periodPlanningContext?: LessonNotePeriodPlanningContext | null;
  subjectName?: string;
}) {
  const isSchemeLinked = Boolean(formData.schemeId || (formData.schemeItemIds?.length ?? 0) > 0);
  if (!isSchemeLinked) return null;

  const weekRange = formatDateRangeLabel(formData.weekOf, formData.weekEndingDate);
  const periodMinutes = formData.durationMinutes ?? periodPlanningContext?.typicalPeriodMinutes ?? 40;
  const periodsThisWeek = periodPlanningContext?.periodsThisWeek;
  const subjectLabel = subjectName?.trim() || "this subject";

  let timetableLine = "";
  if (periodPlanningContext?.hasPublishedTimetable && typeof periodsThisWeek === "number") {
    if (periodsThisWeek === 0) {
      timetableLine =
        "No published timetable periods were found for this class and subject in the scheme week.";
    } else if (periodsThisWeek === 1) {
      timetableLine = `Your timetable shows 1 ${subjectLabel} period (${periodMinutes} min) in this scheme week.`;
    } else {
      timetableLine = `Your timetable shows ${periodsThisWeek} ${subjectLabel} periods (${periodMinutes} min each) in this scheme week.`;
    }
  }

  return (
    <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-50/90">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
        <div className="space-y-1.5">
          <p className="font-medium text-sky-100">Scheme week vs. one period</p>
          <p className="text-xs leading-relaxed text-sky-100/75">
            The linked scheme row covers the teaching week
            {weekRange ? ` (${weekRange})` : ""}. <span className="text-sky-50">Period length</span>{" "}
            is how long <span className="text-sky-50">one</span> lesson delivery lasts — not the total
            time for the whole week.
          </p>
          {timetableLine ? (
            <p className="text-xs leading-relaxed text-sky-100/75">{timetableLine}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-sky-100/65">
            After this note is approved, you can split it across your timetable periods when creating
            weekly lessons.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContextStep({
  formData,
  classOptions,
  onUpdate,
  onTemplateChange,
  curriculumCode = "ghana_nacca",
  aiContext,
  periodPlanningContext,
}: ContextStepProps) {
  const selectedClass = classOptions.find((c) => c.id === formData.classGroupId);
  const subjects = selectedClass?.subjects || [];
  const selectedSubject = subjects.find((s) => s.id === formData.subjectId);

  React.useEffect(() => {
    if (formData.subjectId && !subjects.some((s) => s.id === formData.subjectId)) {
      onUpdate({ subjectId: subjects[0]?.id || undefined });
    }
  }, [formData.classGroupId, formData.subjectId, subjects, onUpdate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Lesson Context</h2>
        <p className="text-sm text-white/60">
          Set the basic details for your lesson note
        </p>
      </div>

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

      <SchemeWeekPlanningCallout
        formData={formData}
        periodPlanningContext={periodPlanningContext}
        subjectName={selectedSubject?.name}
      />

      {formData.weekEndingDate ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-medium">Scheme teaching week:</span>{" "}
          {formatDateRangeLabel(formData.weekOf, formData.weekEndingDate)}
        </div>
      ) : null}

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
          formData.durationMinutes && `Period length: ${formData.durationMinutes} minutes`,
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
          <p className="text-xs text-white/40">
            {formData.schemeId || (formData.schemeItemIds?.length ?? 0) > 0
              ? "Start of the teaching week this scheme row belongs to."
              : "The week this lesson note applies to."}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-white/70">
            <Clock className="h-4 w-4" />
            Period length
          </Label>
          <PremiumSelect
            value={formData.durationMinutes?.toString() || "40"}
            onValueChange={(value) => onUpdate({ durationMinutes: parseInt(value, 10) })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Period length" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {DURATION_OPTIONS.map((option) => (
                <PremiumSelectItem key={option.value} value={option.value}>
                  {option.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <p className="text-xs text-white/40">
            Length of one teaching period this plan is written for — not total time for the week.
            {periodPlanningContext?.typicalPeriodMinutes
              ? ` Your school timetable uses ${periodPlanningContext.typicalPeriodMinutes}-minute periods.`
              : " Most schools use 40-minute periods."}
          </p>
        </div>
      </div>

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
