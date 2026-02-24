"use client";

import * as React from "react";
import { Play, BookOpen, MessageSquare, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import type { LessonNoteFormData, NaCCA3PhaseBody } from "@/types/lesson-notes";
import { isNaCCA3PhaseBody, DEFAULT_NACCA_BODY } from "@/types/lesson-notes";
import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";
import type { LessonPhase, LessonPhaseField } from "@/constants/curriculum-lesson-templates";

type DynamicPhaseEditorProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

const PHASE_ICONS: Record<number, React.ReactNode> = {
  0: <Play className="h-4 w-4" />,
  1: <BookOpen className="h-4 w-4" />,
  2: <MessageSquare className="h-4 w-4" />,
};

const PHASE_COLORS = ["amber", "indigo", "emerald"] as const;

export function DynamicPhaseEditor({ formData, onUpdate }: DynamicPhaseEditorProps) {
  const templateDef = getTemplateDefinition(formData.templateType);
  const phases = templateDef?.phases || [];

  // The body uses the same NaCCA3PhaseBody shape (starter/main/plenary) for all 3-phase templates
  const body: NaCCA3PhaseBody = isNaCCA3PhaseBody(formData.body)
    ? formData.body
    : { ...DEFAULT_NACCA_BODY };

  const [activePhase, setActivePhase] = React.useState(0);

  const phaseKeyMap: Record<number, "starter" | "main" | "plenary"> = {
    0: "starter",
    1: "main",
    2: "plenary",
  };

  const updatePhaseField = (phaseIdx: number, fieldKey: string, value: string | number) => {
    const phaseKey = phaseKeyMap[phaseIdx];
    if (!phaseKey) return;
    const updatedBody = {
      ...body,
      [phaseKey]: {
        ...body[phaseKey],
        [fieldKey]: value,
      },
    };
    onUpdate({ body: updatedBody });
  };

  const totalTime = phases.reduce((sum, _, idx) => {
    const phaseKey = phaseKeyMap[idx];
    return sum + ((body[phaseKey] as unknown as Record<string, unknown>)?.timeMins as number || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{templateDef?.label || "Lesson Body"}</h2>
          <p className="text-sm text-white/60">
            Build your lesson across {phases.length} phases
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5">
          <Clock className="h-4 w-4 text-white/50" />
          <span className="text-sm font-medium text-white/70">{totalTime} min total</span>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2">
        {phases.map((phase, idx) => {
          const isActive = activePhase === idx;
          const color = PHASE_COLORS[idx] || "indigo";
          return (
            <button
              key={phase.key}
              type="button"
              onClick={() => setActivePhase(idx)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? `bg-${color}-500/20 text-${color === "amber" ? "amber" : color}-200 ring-1 ring-${color}-400/50`
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
              )}
            >
              {PHASE_ICONS[idx] || <BookOpen className="h-4 w-4" />}
              {phase.label}
            </button>
          );
        })}
      </div>

      {/* Active phase content */}
      {phases.map((phase, idx) => {
        if (idx !== activePhase) return null;
        const phaseKey = phaseKeyMap[idx];
        const phaseData = (body[phaseKey] as unknown as Record<string, unknown>) || {};

        return (
          <div key={phase.key} className="space-y-5 rounded-2xl border border-white/10 bg-white/2 p-5">
            {/* Time input */}
            <div className="flex items-center gap-3">
              <Label className="text-white/70 whitespace-nowrap">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                Duration
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={(phaseData.timeMins as number) || phase.defaultTimeMins}
                  onChange={(e) => updatePhaseField(idx, "timeMins", parseInt(e.target.value, 10) || 0)}
                  className="w-20 border-white/10 bg-white/5 text-white text-center"
                  min={1}
                  max={120}
                />
                <span className="text-sm text-white/50">minutes</span>
              </div>
            </div>

            {/* Fields */}
            {phase.fields.map((field) => (
              <PhaseFieldRenderer
                key={field.key}
                field={field}
                value={phaseData[field.key] as string || ""}
                onChange={(val) => updatePhaseField(idx, field.key, val)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PhaseFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: LessonPhaseField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "richtext") {
    return (
      <div className="space-y-2">
        <Label className="text-white/70">
          {field.label}
          {field.required && <span className="text-rose-400 ml-1">*</span>}
        </Label>
        <CompactRichText
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-2">
        <Label className="text-white/70">{field.label}</Label>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="border-white/10 bg-white/5 text-white"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-white/70">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="border-white/10 bg-white/5 text-white"
      />
    </div>
  );
}
