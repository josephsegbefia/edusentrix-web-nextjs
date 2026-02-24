// src/components/modals/SubjectsSetupModal.tsx
"use client";

import * as React from "react";
import { GHANA_BASIC_SUBJECTS } from "@/constants/ghana-basic-subjects";
import {
  getSubjectTemplatesForCurriculum,
  type SubjectTemplateEntry,
} from "@/constants/curriculum-subject-templates";
import type { CurriculumCode } from "@/constants/curriculum-profiles";
import { useBulkCreateSubjects } from "@/hooks/admin/useBulkCreateSubjects";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  onDone: () => void;
  curriculumCode?: CurriculumCode;
  schoolType?: string;
};

const categoryLabels: Record<string, string> = {
  core: "Core",
  elective: "Elective",
  foundation: "Foundation",
  optional: "Optional",
  transdisciplinary_theme: "Theme",
  subject_group: "Subject Group",
};

const categoryColors: Record<string, string> = {
  core: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  elective: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  foundation: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  optional: "border-white/15 bg-white/5 text-white/60",
  transdisciplinary_theme:
    "border-violet-500/25 bg-violet-500/10 text-violet-300",
  subject_group: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
};

export function SubjectsSetupModal({ onDone, curriculumCode, schoolType }: Props) {
  const templates: SubjectTemplateEntry[] = React.useMemo(() => {
    if (curriculumCode && curriculumCode !== "ghana_nacca") {
      return getSubjectTemplatesForCurriculum(curriculumCode, schoolType);
    }
    return GHANA_BASIC_SUBJECTS.map((name) => ({
      name,
      category: "core" as const,
    }));
  }, [curriculumCode, schoolType]);

  const subjectNames = React.useMemo(
    () => templates.map((t) => t.name),
    [templates]
  );

  const [selected, setSelected] = React.useState<string[]>([...subjectNames]);
  const [custom, setCustom] = React.useState<string>("");
  const createSubjects = useBulkCreateSubjects();

  React.useEffect(() => {
    setSelected([...subjectNames]);
  }, [subjectNames]);

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function addCustom() {
    const parts = custom
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setSelected((prev) => Array.from(new Set([...prev, ...parts])));
    setCustom("");
  }

  async function handleCreate() {
    if (selected.length === 0) return;
    await createSubjects.mutateAsync(selected);
    onDone();
  }

  const curriculumLabel =
    curriculumCode && curriculumCode !== "ghana_nacca"
      ? `Recommended subjects for your curriculum`
      : "We recommend the Ghana Basic Curriculum subjects";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/80">
          {curriculumLabel}. Uncheck any you don&apos;t need and add your own
          before creating.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-auto pr-1">
        {templates.map((t) => (
          <label
            key={t.name}
            className="flex items-center gap-2 rounded-md p-2 hover:bg-white/5 cursor-pointer border border-white/10 bg-white/5"
          >
            <input
              type="checkbox"
              checked={selected.includes(t.name)}
              onChange={() => toggle(t.name)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
            />
            <span className="text-sm text-white/80 flex-1">{t.name}</span>
            {t.category && (
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 ${categoryColors[t.category] || ""}`}
              >
                {categoryLabels[t.category] || t.category}
              </Badge>
            )}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Add Custom Subjects (comma separated)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g., Music, Entrepreneurship"
            className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <Button
            type="button"
            onClick={addCustom}
            className="bg-brand text-black hover:opacity-90"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Skip
        </Button>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={createSubjects.isPending || selected.length === 0}
          className="bg-brand text-black hover:opacity-90"
        >
          {createSubjects.isPending ? "Creating…" : "Create Subjects"}
        </Button>
      </div>
    </div>
  );
}
