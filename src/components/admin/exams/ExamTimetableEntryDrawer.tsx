"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
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
import type { ExamSessionDTO, ExamTimetableEntryDTO } from "@/types/academics/exam-scheduling-engine";
import {
  useCreateExamTimetableEntry,
  useUpdateExamTimetableEntry,
} from "@/hooks/admin/useExamTimetableEntries";
import { useExamVenues } from "@/hooks/admin/useExamVenues";
import { useBusyToast } from "@/hooks/useBusyToast";
import type { CreateExamTimetableEntryBodyInput } from "@/lib/exams/exam-timetable-entry-service";
import { ExamAssessmentLinkSection } from "@/components/admin/exams/ExamAssessmentLinkSection";

type ExamTimetableEntryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  entry?: ExamTimetableEntryDTO | null;
  onCompleted?: () => void;
};

type EntryFormState = {
  title: string;
  subjectId: string;
  classGroupIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  roomLabel: string;
  status: "draft" | "ready";
};

function createDefaultFormState(): EntryFormState {
  return {
    title: "",
    subjectId: "",
    classGroupIds: [],
    date: "",
    startTime: "08:00",
    endTime: "10:00",
    venueId: "",
    roomLabel: "",
    status: "draft",
  };
}

function entryToFormState(entry: ExamTimetableEntryDTO): EntryFormState {
  return {
    title: entry.title ?? "",
    subjectId: entry.subjectId,
    classGroupIds: entry.classGroupIds,
    date: entry.isUnscheduled ? "" : entry.date.slice(0, 10),
    startTime: entry.startTime,
    endTime: entry.endTime,
    venueId: entry.venueId ?? "",
    roomLabel: entry.roomLabel ?? "",
    status: entry.status === "ready" ? "ready" : "draft",
  };
}

function buildPayload(form: EntryFormState): CreateExamTimetableEntryBodyInput {
  return {
    title: form.title.trim() ? form.title.trim() : null,
    subjectId: form.subjectId,
    classGroupIds: form.classGroupIds,
    date: form.date,
    startTime: form.startTime,
    endTime: form.endTime,
    venueId: form.venueId ? form.venueId : null,
    roomLabel: form.roomLabel.trim() ? form.roomLabel.trim() : null,
    status: form.status,
  };
}

export function ExamTimetableEntryDrawer({
  open,
  onOpenChange,
  session,
  entry,
  onCompleted,
}: ExamTimetableEntryDrawerProps) {
  const busy = useBusyToast();
  const isEditing = Boolean(entry?.id);
  const [form, setForm] = React.useState<EntryFormState>(createDefaultFormState());

  const createEntry = useCreateExamTimetableEntry(session.id);
  const updateEntry = useUpdateExamTimetableEntry(session.id);
  const { data: venuesData } = useExamVenues({ activeOnly: true });

  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["exam-timetable-subjects"],
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

  const { data: classGroupsData, isLoading: classGroupsLoading } = useQuery({
    queryKey: [
      "exam-timetable-class-groups",
      session.id,
      session.appliesToGradeIds.join(","),
    ],
    enabled: open && session.appliesToGradeIds.length > 0,
    queryFn: async () => {
      const gradeIds =
        session.appliesToGradeIds.length > 0 ? session.appliesToGradeIds : [];
      const results = await Promise.all(
        gradeIds.map(async (gradeId) => {
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

  React.useEffect(() => {
    if (!open) return;
    setForm(entry ? entryToFormState(entry) : createDefaultFormState());
  }, [open, entry]);

  const subjects = subjectsData ?? [];
  const classGroups = classGroupsData ?? [];
  const classGroupLabels = React.useMemo(
    () =>
      Object.fromEntries(
        classGroups.map((group) => [group.id, group.label || group.name])
      ),
    [classGroups]
  );
  const venues = venuesData?.data ?? [];
  const canMutate = ["draft", "scheduled", "conflict_review"].includes(session.status);
  const canEditEntry = !entry || entry.status === "draft" || entry.status === "ready";

  function updateForm(patch: Partial<EntryFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

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

  async function handleSubmit() {
    if (!form.subjectId) {
      busy.error("Select a subject.");
      return;
    }
    if (form.classGroupIds.length === 0) {
      busy.error("Select at least one class group.");
      return;
    }
    if (!form.date) {
      busy.error("Select an exam date.");
      return;
    }
    if (!form.startTime || !form.endTime) {
      busy.error("Start and end time are required.");
      return;
    }

    const payload = buildPayload(form);
    const promise = isEditing
      ? updateEntry.mutateAsync({ entryId: entry!.id, input: payload })
      : createEntry.mutateAsync(payload);

    await busy.promise(promise, {
      loading: isEditing ? "Updating exam paper…" : "Adding exam paper…",
      success: isEditing ? "Exam paper updated" : "Exam paper added",
      error: (error) =>
        error instanceof Error ? error.message : "Could not save exam paper",
    });

    onOpenChange(false);
    onCompleted?.();
  }

  const isSaving = createEntry.isPending || updateEntry.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit exam paper" : "Add exam paper"}
      description="Schedule a subject paper for one or more class groups."
    >
      {!canMutate ? (
        <div className={cn(glassInsetClass, "p-4 text-sm text-amber-100")}>
          This exam session can no longer be edited from the timetable builder.
        </div>
      ) : null}

      <div className={cn(glassInsetClass, "space-y-4 p-4")}>
        {entry?.isUnscheduled ? (
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            This paper is unscheduled. Set a date and time to place it on the timetable.
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="entry-title">Title (optional)</Label>
          <Input
            id="entry-title"
            value={form.title}
            onChange={(event) => updateForm({ title: event.target.value })}
            placeholder="Basic 6 Mathematics"
            disabled={!canMutate || !canEditEntry}
          />
        </div>

        <div className="space-y-2">
          <Label>Subject</Label>
          {subjectsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading subjects…
            </div>
          ) : (
            <PremiumSelect
              value={form.subjectId}
              onValueChange={(value) => updateForm({ subjectId: value })}
              disabled={!canMutate || !canEditEntry}
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
          )}
        </div>

        <div className="space-y-2">
          <Label>Class groups</Label>
          {classGroupsLoading ? (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading class groups…
            </div>
          ) : classGroups.length === 0 ? (
            <p className="text-sm text-white/50">
              No class groups found for this exam session scope.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classGroups.map((group) => {
                const selected = form.classGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    disabled={!canMutate || !canEditEntry}
                    onClick={() => toggleClassGroup(group.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-50",
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <CustomDatePicker
              label="Date"
              value={form.date ? new Date(`${form.date}T00:00:00`) : null}
              onChange={(date) =>
                updateForm({ date: date ? date.toISOString().slice(0, 10) : "" })
              }
              disabled={!canMutate || !canEditEntry}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-start">Start time</Label>
            <Input
              id="entry-start"
              value={form.startTime}
              onChange={(event) => updateForm({ startTime: event.target.value })}
              placeholder="08:00"
              disabled={!canMutate || !canEditEntry}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-end">End time</Label>
            <Input
              id="entry-end"
              value={form.endTime}
              onChange={(event) => updateForm({ endTime: event.target.value })}
              placeholder="10:00"
              disabled={!canMutate || !canEditEntry}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Venue</Label>
            <PremiumSelect
              value={form.venueId || "none"}
              onValueChange={(value) =>
                updateForm({ venueId: value === "none" ? "" : value })
              }
              disabled={!canMutate || !canEditEntry}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select venue" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="none">No venue selected</PremiumSelectItem>
                {venues.map((venue) => (
                  <PremiumSelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-room">Room label (optional)</Label>
            <Input
              id="entry-room"
              value={form.roomLabel}
              onChange={(event) => updateForm({ roomLabel: event.target.value })}
              placeholder="Room 4"
              disabled={!canMutate || !canEditEntry}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <PremiumSelect
            value={form.status}
            onValueChange={(value) =>
              updateForm({ status: value as EntryFormState["status"] })
            }
            disabled={!canMutate || !canEditEntry}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="draft">Draft</PremiumSelectItem>
              <PremiumSelectItem value="ready">Ready</PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      </div>

      {isEditing && entry ? (
        <div className="mt-4">
          <ExamAssessmentLinkSection
            session={session}
            entry={entry}
            canMutate={canMutate && canEditEntry}
            classGroupLabels={classGroupLabels}
          />
        </div>
      ) : (
        <div className={cn(glassInsetClass, "mt-4 p-4 text-sm text-white/55")}>
          Save this exam paper first, then link assessment items from the gradebook.
        </div>
      )}

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
        {canMutate && canEditEntry ? (
          <Button
            type="button"
            className={glassPrimaryButtonClass}
            onClick={() => void handleSubmit()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Add exam paper"
            )}
          </Button>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
