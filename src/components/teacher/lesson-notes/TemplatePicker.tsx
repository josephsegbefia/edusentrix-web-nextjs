"use client";

import * as React from "react";
import { BookOpen, GraduationCap, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { type LessonNoteTemplateType, TEMPLATE_LABELS } from "@/types/lesson-notes";

type TemplatePickerProps = {
  value: LessonNoteTemplateType;
  onChange: (value: LessonNoteTemplateType) => void;
  disabled?: boolean;
};

const TEMPLATES: {
  id: LessonNoteTemplateType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  phases: string[];
}[] = [
  {
    id: "NACCA_3_PHASE",
    label: "NaCCA 3-Phase",
    description: "Primary school format with structured phases",
    icon: <BookOpen className="h-5 w-5" />,
    color: "indigo",
    phases: ["Starter (5-10 min)", "Main Activity", "Plenary/Reflection"],
  },
  {
    id: "CLASSIC_JHS",
    label: "Classic JHS",
    description: "Traditional JHS format with detailed steps",
    icon: <GraduationCap className="h-5 w-5" />,
    color: "emerald",
    phases: ["Objectives & RPK", "Presentation Steps", "Evaluation & Remarks"],
  },
  {
    id: "SIMPLE",
    label: "Quick Note",
    description: "Simple format for quick lesson planning",
    icon: <FileText className="h-5 w-5" />,
    color: "amber",
    phases: ["Objectives", "Lesson Content"],
  },
];

export function TemplatePicker({ value, onChange, disabled }: TemplatePickerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TEMPLATES.map((template) => {
        const isSelected = value === template.id;
        const colorClasses = {
          indigo: {
            bg: isSelected ? "bg-indigo-500/20" : "bg-white/5",
            border: isSelected ? "border-indigo-400/50" : "border-white/10",
            icon: isSelected ? "bg-indigo-500/30 text-indigo-200" : "bg-white/10 text-white/60",
            ring: "ring-indigo-400/50",
          },
          emerald: {
            bg: isSelected ? "bg-emerald-500/20" : "bg-white/5",
            border: isSelected ? "border-emerald-400/50" : "border-white/10",
            icon: isSelected ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/60",
            ring: "ring-emerald-400/50",
          },
          amber: {
            bg: isSelected ? "bg-amber-500/20" : "bg-white/5",
            border: isSelected ? "border-amber-400/50" : "border-white/10",
            icon: isSelected ? "bg-amber-500/30 text-amber-200" : "bg-white/10 text-white/60",
            ring: "ring-amber-400/50",
          },
        }[template.color];

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => !disabled && onChange(template.id)}
            disabled={disabled}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition-all",
              colorClasses.bg,
              colorClasses.border,
              isSelected && `ring-1 ${colorClasses.ring}`,
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-white/10"
            )}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}

            {/* Icon */}
            <div
              className={cn(
                "mb-3 flex h-10 w-10 items-center justify-center rounded-xl",
                colorClasses.icon
              )}
            >
              {template.icon}
            </div>

            {/* Title */}
            <h3 className="mb-1 font-semibold text-white">{template.label}</h3>

            {/* Description */}
            <p className="mb-3 text-xs text-white/60">{template.description}</p>

            {/* Phases */}
            <div className="space-y-1">
              {template.phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {idx + 1}
                  </span>
                  {phase}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
