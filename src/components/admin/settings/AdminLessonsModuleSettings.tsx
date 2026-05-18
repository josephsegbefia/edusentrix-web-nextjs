"use client";

import { Presentation, Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { LessonsModuleSettings } from "@/lib/lessons/settings-shared";

type Props = {
  value: LessonsModuleSettings;
  onChange: (next: LessonsModuleSettings) => void;
};

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Label className="flex items-center gap-2 text-white/80">
          {icon}
          {label}
        </Label>
        <p className="text-xs text-white/50">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function AdminLessonsModuleSettings({ value, onChange }: Props) {
  const set = (patch: Partial<LessonsModuleSettings>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
      <p className="text-sm font-semibold text-white">Lessons module</p>
      <ToggleRow
        label="Lessons enabled"
        description="Master switch for teacher lessons, week plans, and related APIs."
        checked={value.enabled}
        onCheckedChange={(enabled) => set({ enabled })}
        icon={<Presentation className="h-4 w-4 text-violet-300" />}
      />
      <ToggleRow
        label="Require approved lesson notes"
        description="Teachers cannot create lessons until the school approves the weekly lesson note."
        checked={value.requireApprovedLessonNoteToPublish}
        onCheckedChange={(requireApprovedLessonNoteToPublish) =>
          set({ requireApprovedLessonNoteToPublish })
        }
      />
      <ToggleRow
        label="Student lesson view"
        description="Students can open published lesson sessions (web/mobile when enabled)."
        checked={value.enableStudentLessonView}
        onCheckedChange={(enableStudentLessonView) => set({ enableStudentLessonView })}
      />
      <ToggleRow
        label="Flashcards"
        description="Per-session flashcards for revision."
        checked={value.enableFlashcards}
        onCheckedChange={(enableFlashcards) => set({ enableFlashcards })}
      />
      <ToggleRow
        label="Resources"
        description="Attach files and links to lesson sessions."
        checked={value.enableResources}
        onCheckedChange={(enableResources) => set({ enableResources })}
      />
      <ToggleRow
        label="Teaching mode"
        description="Presenter-style teaching flow for sessions."
        checked={value.enableTeachingMode}
        onCheckedChange={(enableTeachingMode) => set({ enableTeachingMode })}
      />
      <ToggleRow
        label="Lesson analytics"
        description="Teacher and admin lesson analytics surfaces."
        checked={value.enableLessonAnalytics}
        onCheckedChange={(enableLessonAnalytics) => set({ enableLessonAnalytics })}
      />
      <ToggleRow
        label="Leo lesson tools"
        description="AI drafts on lessons (requires subscription and lessonAi.use permission)."
        checked={value.enableLeoLessonTools}
        onCheckedChange={(enableLeoLessonTools) => set({ enableLeoLessonTools })}
        icon={<Sparkles className="h-4 w-4 text-violet-300" />}
      />
      <ToggleRow
        label="Parent lesson summaries"
        description="Guardians can read teacher-written family summaries on published sessions."
        checked={value.parentSummaryVisibleToParents}
        onCheckedChange={(parentSummaryVisibleToParents) =>
          set({ parentSummaryVisibleToParents })
        }
      />
    </div>
  );
}
