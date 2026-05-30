"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { ExamSessionDTO } from "@/types/academics/exam-scheduling-engine";
import { useGenerateExamDraftEntries } from "@/hooks/admin/useExamTimetableEntries";
import { useBusyToast } from "@/hooks/useBusyToast";

type ExamDraftGenerationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  onCompleted?: (result: { createdCount: number; skippedCount: number }) => void;
};

type DraftGenerationForm = {
  classGroupIds: string[];
  subjectIds: string[];
  defaultDurationMinutes: number;
  defaultMaxScore: number;
  assessmentComponentKey: string;
};

function createDefaultForm(): DraftGenerationForm {
  return {
    classGroupIds: [],
    subjectIds: [],
    defaultDurationMinutes: 120,
    defaultMaxScore: 100,
    assessmentComponentKey: "exam",
  };
}

export function ExamDraftGenerationModal({
  open,
  onOpenChange,
  session,
  onCompleted,
}: ExamDraftGenerationModalProps) {
  const busy = useBusyToast();
  const [form, setForm] = React.useState<DraftGenerationForm>(createDefaultForm());
  const generateDrafts = useGenerateExamDraftEntries(session.id);

  const { data: classGroupsData, isLoading: classGroupsLoading } = useQuery({
    queryKey: ["exam-draft-class-groups", session.id, session.appliesToGradeIds.join(",")],
    enabled: open && session.appliesToGradeIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        session.appliesToGradeIds.map(async (gradeId) => {
          const res = await fetch(
            `/api/admin/class-groups/search?gradeId=${encodeURIComponent(gradeId)}&limit=50`,
            { cache: "no-store" }
          );
          const json = (await res.json()) as {
            success?: boolean;
            data?: Array<{ id: string; label: string; name: string }>;
          };
          if (!res.ok || !json.success) throw new Error("Failed to load class groups");
          return json.data ?? [];
        })
      );
      const merged = new Map<string, { id: string; label: string; name: string }>();
      for (const group of results.flat()) merged.set(group.id, group);
      const scopedIds = new Set(session.appliesToClassGroupIds);
      const all = Array.from(merged.values());
      if (scopedIds.size === 0) return all;
      return all.filter((group) => scopedIds.has(group.id));
    },
  });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["exam-draft-subjects"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/admin/subjects?isActive=true", { cache: "no-store" });
      const json = (await res.json()) as {
        data?: Array<{ _id?: string; id?: string; name?: string }>;
      };
      if (!res.ok) throw new Error("Failed to load subjects");
      return (json.data ?? []).map((row) => ({
        id: String(row._id ?? row.id ?? ""),
        name: String(row.name ?? ""),
      }));
    },
  });

  React.useEffect(() => {
    if (!open) return;
    setForm(createDefaultForm());
  }, [open, session.id]);

  const classGroups = classGroupsData ?? [];
  const subjects = subjectsData ?? [];

  function toggleClassGroup(classGroupId: string) {
    setForm((prev) => {
      const exists = prev.classGroupIds.includes(classGroupId);
      return {
        ...prev,
        classGroupIds: exists
          ? prev.classGroupIds.filter((id) => id !== classGroupId)
          : [...prev.classGroupIds, classGroupId],
      };
    });
  }

  function toggleSubject(subjectId: string) {
    setForm((prev) => {
      const exists = prev.subjectIds.includes(subjectId);
      return {
        ...prev,
        subjectIds: exists
          ? prev.subjectIds.filter((id) => id !== subjectId)
          : [...prev.subjectIds, subjectId],
      };
    });
  }

  async function handleSubmit() {
    if (form.classGroupIds.length === 0) {
      busy.error("Select at least one class group.");
      return;
    }

    const result = await busy.promise(
      generateDrafts.mutateAsync({
        classGroupIds: form.classGroupIds,
        subjectIds: form.subjectIds,
        defaultDurationMinutes: form.defaultDurationMinutes,
        defaultMaxScore: form.defaultMaxScore,
        assessmentComponentKey: form.assessmentComponentKey.trim() || "exam",
        contributesToReport: true,
      }),
      {
        loading: "Generating draft papers…",
        success: (data) =>
          data.createdCount > 0
            ? `Created ${data.createdCount} draft paper${data.createdCount === 1 ? "" : "s"}`
            : "No new draft papers were created",
        error: (error) =>
          error instanceof Error ? error.message : "Could not generate draft papers",
      }
    );

    onOpenChange(false);
    onCompleted?.({
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
    });
  }

  const isSaving = generateDrafts.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Generate draft papers"
      description="Create unscheduled draft rows from selected classes and subjects. You can assign dates and times afterward."
    >
      <div className={cn(glassInsetClass, "space-y-5 p-4")}>
        <div>
          <Label className="mb-2 block">Class groups</Label>
          {classGroupsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading class groups…
            </div>
          ) : classGroups.length === 0 ? (
            <p className="text-sm text-white/50">No class groups available for this session.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classGroups.map((group) => {
                const selected = form.classGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleClassGroup(group.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selected
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                    )}
                  >
                    {group.label || group.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Subjects</Label>
          <p className="mb-2 text-xs text-white/45">
            Leave all unselected to include every subject offered to the selected classes.
          </p>
          {subjectsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subjects…
            </div>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {subjects.map((subject) => {
                const selected = form.subjectIds.includes(subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition",
                      selected
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                    )}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="draft-duration">Default duration (minutes)</Label>
            <Input
              id="draft-duration"
              type="number"
              min={15}
              max={720}
              value={form.defaultDurationMinutes}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  defaultDurationMinutes: Number(event.target.value) || 120,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft-max-score">Default max score</Label>
            <Input
              id="draft-max-score"
              type="number"
              min={1}
              max={1000}
              value={form.defaultMaxScore}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  defaultMaxScore: Number(event.target.value) || 100,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Assessment component</Label>
            <PremiumSelect
              value={form.assessmentComponentKey}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, assessmentComponentKey: value }))
              }
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="exam">Exam</PremiumSelectItem>
                <PremiumSelectItem value="ca">CA</PremiumSelectItem>
                <PremiumSelectItem value="project">Project</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          onClick={() => void handleSubmit()}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate drafts
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
