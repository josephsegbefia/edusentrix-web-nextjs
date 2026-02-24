"use client";

import * as React from "react";
import {
  BookOpen,
  GraduationCap,
  FileText,
  Globe,
  Compass,
  Flag,
  Layers,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { LessonNoteTemplateType } from "@/types/lesson-notes";
import type {
  LessonTemplateDefinition,
  LessonTemplateType,
} from "@/constants/curriculum-lesson-templates";
import {
  getTemplatesForCurriculum,
} from "@/constants/curriculum-lesson-templates";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

type TemplatePickerProps = {
  value: LessonNoteTemplateType;
  onChange: (value: LessonNoteTemplateType) => void;
  curriculumCode?: CurriculumCode;
  disabled?: boolean;
};

const ICON_MAP: Record<string, React.ReactNode> = {
  book: <BookOpen className="h-5 w-5" />,
  graduation: <GraduationCap className="h-5 w-5" />,
  file: <FileText className="h-5 w-5" />,
  globe: <Globe className="h-5 w-5" />,
  compass: <Compass className="h-5 w-5" />,
  flag: <Flag className="h-5 w-5" />,
  layers: <Layers className="h-5 w-5" />,
};

const COLOR_MAP: Record<
  string,
  {
    bg: (selected: boolean) => string;
    border: (selected: boolean) => string;
    icon: (selected: boolean) => string;
    ring: string;
  }
> = {
  indigo: {
    bg: (s) => (s ? "bg-indigo-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-indigo-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-indigo-500/30 text-indigo-200" : "bg-white/10 text-white/60"),
    ring: "ring-indigo-400/50",
  },
  emerald: {
    bg: (s) => (s ? "bg-emerald-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-emerald-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-emerald-500/30 text-emerald-200" : "bg-white/10 text-white/60"),
    ring: "ring-emerald-400/50",
  },
  amber: {
    bg: (s) => (s ? "bg-amber-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-amber-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-amber-500/30 text-amber-200" : "bg-white/10 text-white/60"),
    ring: "ring-amber-400/50",
  },
  blue: {
    bg: (s) => (s ? "bg-blue-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-blue-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-blue-500/30 text-blue-200" : "bg-white/10 text-white/60"),
    ring: "ring-blue-400/50",
  },
  violet: {
    bg: (s) => (s ? "bg-violet-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-violet-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-violet-500/30 text-violet-200" : "bg-white/10 text-white/60"),
    ring: "ring-violet-400/50",
  },
  rose: {
    bg: (s) => (s ? "bg-rose-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-rose-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-rose-500/30 text-rose-200" : "bg-white/10 text-white/60"),
    ring: "ring-rose-400/50",
  },
  cyan: {
    bg: (s) => (s ? "bg-cyan-500/20" : "bg-white/5"),
    border: (s) => (s ? "border-cyan-400/50" : "border-white/10"),
    icon: (s) => (s ? "bg-cyan-500/30 text-cyan-200" : "bg-white/10 text-white/60"),
    ring: "ring-cyan-400/50",
  },
};

function getPhaseLabels(template: LessonTemplateDefinition): string[] {
  if (template.phases) {
    return template.phases.map((p) => `${p.label} (${p.defaultTimeMins} min)`);
  }
  if (template.unitSections) {
    return template.unitSections.map((s) => s.label);
  }
  return template.wizardSteps.filter((s) => s.id !== "review").map((s) => s.label);
}

export function TemplatePicker({
  value,
  onChange,
  curriculumCode = "ghana_nacca",
  disabled,
}: TemplatePickerProps) {
  const templates = getTemplatesForCurriculum(curriculumCode);

  const gridCols =
    templates.length <= 2
      ? "sm:grid-cols-2"
      : templates.length <= 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={cn("grid gap-4", gridCols)}>
      {templates.map((template) => {
        const isSelected = value === template.id;
        const colors = COLOR_MAP[template.color] || COLOR_MAP.indigo;
        const phases = getPhaseLabels(template);

        return (
          <button
            key={template.id}
            type="button"
            onClick={() =>
              !disabled && onChange(template.id as LessonNoteTemplateType)
            }
            disabled={disabled}
            className={cn(
              "relative rounded-2xl border p-4 text-left transition-all",
              colors.bg(isSelected),
              colors.border(isSelected),
              isSelected && `ring-1 ${colors.ring}`,
              disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-white/10"
            )}
          >
            {isSelected && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}

            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  colors.icon(isSelected)
                )}
              >
                {ICON_MAP[template.icon] || ICON_MAP.book}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {template.shortLabel}
                  </h3>
                  {template.granularity === "unit" && (
                    <Badge
                      variant="outline"
                      className="border-violet-500/30 bg-violet-500/10 text-violet-300 text-[10px] px-1.5 py-0"
                    >
                      Unit
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-white/50 line-clamp-2">
                  {template.description}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              {phases.slice(0, 4).map((phase, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs text-white/40"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="truncate">{phase}</span>
                </div>
              ))}
              {phases.length > 4 && (
                <p className="text-[10px] text-white/30 pl-6">
                  +{phases.length - 4} more
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
