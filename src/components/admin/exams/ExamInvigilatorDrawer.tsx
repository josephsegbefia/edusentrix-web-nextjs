"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { premiumMenuItem, premiumSelectContent } from "@/components/ui/premium";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTeacherSearch } from "@/hooks/admin/useDirectorySearch";
import {
  useAssignExamInvigilator,
  useExamInvigilatorAssignments,
  useRemoveExamInvigilator,
  useTeacherLabelMap,
} from "@/hooks/admin/useExamInvigilators";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { ExamSchedulingLeoPanel } from "@/components/admin/exams/ExamSchedulingLeoPanel";
import type {
  ExamInvigilatorAssignmentDTO,
  ExamInvigilatorRole,
  ExamInvigilatorStatus,
  ExamSessionDTO,
  ExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";

const ASSIGNABLE_ROLES: ExamInvigilatorRole[] = ["lead", "assistant", "standby"];

const ROLE_LABELS: Record<ExamInvigilatorRole, string> = {
  lead: "Lead",
  assistant: "Assistant",
  standby: "Standby",
  relief: "Relief",
};

const STATUS_STYLES: Record<ExamInvigilatorStatus, string> = {
  assigned: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  acknowledged: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  declined: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  replaced: "border-white/10 bg-white/5 text-white/50",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  missed: "border-amber-500/30 bg-amber-500/10 text-amber-100",
};

const ACTIVE_STATUSES: ExamInvigilatorStatus[] = ["assigned", "acknowledged"];

type ExamInvigilatorDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: ExamSessionDTO;
  entry: ExamTimetableEntryDTO;
  subjectLabel?: string;
  classLabels?: string;
  canMutate: boolean;
};

function formatEntrySchedule(entry: ExamTimetableEntryDTO) {
  if (entry.isUnscheduled) return "Unscheduled";
  const date = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${date} · ${entry.startTime} – ${entry.endTime}`;
}

function formatStatus(status: ExamInvigilatorStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function teacherInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExamInvigilatorDrawer({
  open,
  onOpenChange,
  session,
  entry,
  subjectLabel,
  classLabels,
  canMutate,
}: ExamInvigilatorDrawerProps) {
  const busy = useBusyToast();
  const confirm = useConfirmationDialog();
  const [teacherOpen, setTeacherOpen] = React.useState(false);
  const [teacherQuery, setTeacherQuery] = React.useState("");
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<string | null>(null);
  const [selectedTeacherLabel, setSelectedTeacherLabel] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<ExamInvigilatorRole>("lead");
  const [notes, setNotes] = React.useState("");

  const debouncedQuery = useDebouncedValue(teacherQuery, 250);
  const teachersQuery = useTeacherSearch(debouncedQuery);
  const assignInvigilator = useAssignExamInvigilator(session.id);
  const removeInvigilator = useRemoveExamInvigilator(session.id);

  const { data: assignmentsData, isLoading } = useExamInvigilatorAssignments(session.id, {
    entryId: entry.id,
  });

  const assignments = assignmentsData?.data ?? [];
  const activeAssignments = assignments.filter((row) =>
    ACTIVE_STATUSES.includes(row.status)
  );
  const teacherIds = React.useMemo(
    () => [...new Set(activeAssignments.map((row) => row.teacherId))],
    [activeAssignments]
  );
  const { data: teacherLabels } = useTeacherLabelMap(
    React.useMemo(() => {
      const ids = [...teacherIds];
      if (selectedTeacherId && !ids.includes(selectedTeacherId)) {
        ids.push(selectedTeacherId);
      }
      return ids;
    }, [teacherIds, selectedTeacherId])
  );

  React.useEffect(() => {
    if (!selectedTeacherId || selectedTeacherLabel) return;
    const label = teacherLabels?.get(selectedTeacherId);
    if (label) setSelectedTeacherLabel(label);
  }, [selectedTeacherId, selectedTeacherLabel, teacherLabels]);

  React.useEffect(() => {
    if (!open) return;
    setTeacherQuery("");
    setSelectedTeacherId(null);
    setSelectedTeacherLabel(null);
    setRole("lead");
    setNotes("");
    setTeacherOpen(false);
  }, [open, entry.id]);

  async function handleAssign() {
    if (!selectedTeacherId) {
      busy.error("Select a teacher to assign.");
      return;
    }

    await busy.promise(
      assignInvigilator.mutateAsync({
        examTimetableEntryId: entry.id,
        teacherId: selectedTeacherId,
        role,
        notes: notes.trim() ? notes.trim() : null,
      }),
      {
        loading: "Assigning invigilator…",
        success: "Invigilator assigned",
        error: (error) =>
          error instanceof Error ? error.message : "Could not assign invigilator",
      }
    );

    setSelectedTeacherId(null);
    setSelectedTeacherLabel(null);
    setNotes("");
  }

  async function handleRemove(assignment: ExamInvigilatorAssignmentDTO) {
    const teacherName =
      teacherLabels?.get(assignment.teacherId) ?? "this teacher";
    const confirmed = await confirm({
      title: "Remove invigilator?",
      description: `${teacherName} will be removed from this exam paper.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!confirmed) return;

    await busy.promise(removeInvigilator.mutateAsync(assignment.id), {
      loading: "Removing invigilator…",
      success: "Invigilator removed",
      error: (error) =>
        error instanceof Error ? error.message : "Could not remove invigilator",
    });
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Invigilator assignments"
      description="Assign teachers to invigilate this exam paper."
    >
      <div className="space-y-6">
        <div className={cn(glassInsetClass, "space-y-2 p-4")}>
          <p className="text-sm font-medium text-white">
            {subjectLabel ?? entry.title ?? "Exam paper"}
          </p>
          <p className="text-sm text-white/60">{formatEntrySchedule(entry)}</p>
          {classLabels ? (
            <p className="text-sm text-white/60">Class: {classLabels}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-white/80">Assigned invigilators</Label>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/60">
              {activeAssignments.length} active
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading assignments…
            </div>
          ) : activeAssignments.length === 0 ? (
            <div className={cn(glassInsetClass, "px-4 py-8 text-center")}>
              <Users className="mx-auto h-8 w-8 text-white/30" />
              <p className="mt-3 text-sm text-white/60">
                No invigilators assigned yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAssignments.map((assignment) => {
                const name = teacherLabels?.get(assignment.teacherId) ?? "Teacher";
                return (
                  <div
                    key={assignment.id}
                    className={cn(
                      glassInsetClass,
                      "flex items-center justify-between gap-3 p-3"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{name}</p>
                        <Badge
                          variant="outline"
                          className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                        >
                          {ROLE_LABELS[assignment.role]}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[assignment.status]}
                        >
                          {formatStatus(assignment.status)}
                        </Badge>
                      </div>
                    </div>
                    {canMutate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-rose-500/30 text-rose-100 hover:bg-rose-500/10"
                        onClick={() => void handleRemove(assignment)}
                        disabled={removeInvigilator.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canMutate ? (
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-cyan-300" />
              <Label className="text-white/80">Assign invigilator</Label>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Teacher</Label>
              <Popover open={teacherOpen} onOpenChange={setTeacherOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={teacherOpen}
                    className={cn(
                      glassSecondaryButtonClass,
                      "w-full justify-between font-normal"
                    )}
                  >
                    <span className="truncate">
                      {selectedTeacherLabel ?? "Search teachers…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className={cn(
                    premiumSelectContent,
                    "w-[var(--radix-popover-trigger-width)] p-1"
                  )}
                >
                  <Command shouldFilter={false} className="bg-transparent">
                    <CommandInput
                      placeholder="Search teachers…"
                      value={teacherQuery}
                      onValueChange={setTeacherQuery}
                      className="border-b border-neutral-800/60 bg-transparent"
                    />
                    <CommandList className="max-h-[260px] overflow-y-auto">
                      {teachersQuery.isLoading ? (
                        <div className="px-3 py-3 text-sm text-neutral-400">
                          Searching…
                        </div>
                      ) : (
                        <>
                          <CommandEmpty className="py-6 text-center text-sm text-neutral-400">
                            No teachers found.
                          </CommandEmpty>
                          <CommandGroup>
                            {(teachersQuery.data?.data ?? []).map((teacher) => (
                              <CommandItem
                                key={teacher.id}
                                value={teacher.id}
                                onSelect={() => {
                                  setSelectedTeacherId(teacher.id);
                                  setSelectedTeacherLabel(teacher.fullName);
                                  setTeacherOpen(false);
                                }}
                                className={cn(
                                  premiumMenuItem,
                                  "flex items-center justify-between gap-3"
                                )}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={teacher.photoUrl ?? undefined} />
                                    <AvatarFallback className="text-[10px]">
                                      {teacherInitials(teacher.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm">{teacher.fullName}</p>
                                    {teacher.email ? (
                                      <p className="truncate text-xs text-neutral-400">
                                        {teacher.email}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="border-amber-500/30 bg-amber-500/10 text-amber-100"
                                  >
                                    Availability pending
                                  </Badge>
                                  {selectedTeacherId === teacher.id ? (
                                    <Check className="h-4 w-4 text-neutral-300" />
                                  ) : null}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Role</Label>
              <PremiumSelect
                value={role}
                onValueChange={(value) => setRole(value as ExamInvigilatorRole)}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select role" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {ASSIGNABLE_ROLES.map((item) => (
                    <PremiumSelectItem key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add any notes for this assignment"
                className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
              />
            </div>

            <Button
              type="button"
              className={cn(glassPrimaryButtonClass, "w-full")}
              onClick={() => void handleAssign()}
              disabled={assignInvigilator.isPending || !selectedTeacherId}
            >
              {assignInvigilator.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Assign invigilator
            </Button>

            {activeAssignments[0] ? (
              <ExamSchedulingLeoPanel
                sessionId={session.id}
                mode="invigilator-suggest"
                assignmentId={activeAssignments[0].id}
                onSelectInvigilator={(teacherId) => {
                  setSelectedTeacherId(teacherId);
                  setSelectedTeacherLabel(null);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </ResponsiveModal>
  );
}
