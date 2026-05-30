"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  MapPin,
  Clock3,
  UserPlus,
} from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
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
  useReplaceExamInvigilator,
} from "@/hooks/admin/useExamInvigilators";
import { useUpdateExamTimetableEntry } from "@/hooks/admin/useExamTimetableEntries";
import { useExamVenues } from "@/hooks/admin/useExamVenues";
import { useBusyToast } from "@/hooks/useBusyToast";
import type {
  ExamInvigilatorRole,
  ExamSessionDTO,
  ExamTimetableEntryDTO,
} from "@/types/academics/exam-scheduling-engine";
import type { ConflictFixRequest } from "@/components/admin/exams/exam-conflict-actions";

type ExamConflictFixModalsProps = {
  session: ExamSessionDTO;
  entries: ExamTimetableEntryDTO[];
  fixRequest: ConflictFixRequest | null;
  onOpenChange: (open: boolean) => void;
  onFixed: () => void;
  resolveEntryLabel: (entryId: string) => string;
};

const INVIGILATOR_ROLES: ExamInvigilatorRole[] = ["lead", "assistant", "standby"];

const ROLE_LABELS: Record<ExamInvigilatorRole, string> = {
  lead: "Lead",
  assistant: "Assistant",
  standby: "Standby",
  relief: "Relief",
};

function teacherInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ExamConflictFixModals({
  session,
  entries,
  fixRequest,
  onOpenChange,
  onFixed,
  resolveEntryLabel,
}: ExamConflictFixModalsProps) {
  const open = Boolean(fixRequest);
  if (!fixRequest) return null;

  if (fixRequest.action === "change_time") {
    return (
      <ExamConflictTimeModal
        open={open}
        session={session}
        entries={entries}
        fixRequest={fixRequest}
        onOpenChange={onOpenChange}
        onFixed={onFixed}
        resolveEntryLabel={resolveEntryLabel}
      />
    );
  }

  if (fixRequest.action === "change_venue") {
    return (
      <ExamConflictVenueModal
        open={open}
        session={session}
        entries={entries}
        fixRequest={fixRequest}
        onOpenChange={onOpenChange}
        onFixed={onFixed}
        resolveEntryLabel={resolveEntryLabel}
      />
    );
  }

  return (
    <ExamConflictInvigilatorModal
      open={open}
      session={session}
      entries={entries}
      fixRequest={fixRequest}
      onOpenChange={onOpenChange}
      onFixed={onFixed}
      resolveEntryLabel={resolveEntryLabel}
    />
  );
}

function EntryPicker({
  entryId,
  entryIds,
  onChange,
  resolveEntryLabel,
}: {
  entryId: string;
  entryIds: string[];
  onChange: (entryId: string) => void;
  resolveEntryLabel: (entryId: string) => string;
}) {
  if (entryIds.length <= 1) {
    return (
      <div className={cn(glassInsetClass, "p-3 text-sm text-white/80")}>
        {resolveEntryLabel(entryId)}
      </div>
    );
  }

  return (
    <PremiumSelect value={entryId} onValueChange={onChange}>
      <PremiumSelectTrigger>
        <PremiumSelectValue placeholder="Select exam paper" />
      </PremiumSelectTrigger>
      <PremiumSelectContent>
        {entryIds.map((id) => (
          <PremiumSelectItem key={id} value={id}>
            {resolveEntryLabel(id)}
          </PremiumSelectItem>
        ))}
      </PremiumSelectContent>
    </PremiumSelect>
  );
}

function ExamConflictTimeModal({
  open,
  session,
  entries,
  fixRequest,
  onOpenChange,
  onFixed,
  resolveEntryLabel,
}: {
  open: boolean;
  session: ExamSessionDTO;
  entries: ExamTimetableEntryDTO[];
  fixRequest: ConflictFixRequest;
  onOpenChange: (open: boolean) => void;
  onFixed: () => void;
  resolveEntryLabel: (entryId: string) => string;
}) {
  const busy = useBusyToast();
  const updateEntry = useUpdateExamTimetableEntry(session.id);
  const [entryId, setEntryId] = React.useState(fixRequest.entryId);
  const entry = entries.find((row) => row.id === entryId);
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("08:00");
  const [endTime, setEndTime] = React.useState("10:00");

  React.useEffect(() => {
    if (!open) return;
    setEntryId(fixRequest.entryId);
    const selected = entries.find((row) => row.id === fixRequest.entryId);
    if (!selected) return;
    setDate(selected.isUnscheduled ? "" : selected.date.slice(0, 10));
    setStartTime(selected.startTime);
    setEndTime(selected.endTime);
  }, [open, fixRequest.entryId, entries]);

  React.useEffect(() => {
    if (!entry) return;
    setDate(entry.isUnscheduled ? "" : entry.date.slice(0, 10));
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
  }, [entry?.id]);

  async function handleSave() {
    if (!entry) return;
    if (!date) {
      busy.error("Select an exam date.");
      return;
    }
    if (!startTime || !endTime) {
      busy.error("Start and end time are required.");
      return;
    }

    await busy.promise(
      updateEntry.mutateAsync({
        entryId: entry.id,
        input: { date, startTime, endTime },
      }),
      {
        loading: "Updating exam time…",
        success: "Exam time updated",
        error: (error) =>
          error instanceof Error ? error.message : "Could not update exam time",
      }
    );

    onOpenChange(false);
    onFixed();
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Change exam time"
      description="Adjust the date or time for the affected exam paper."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/70">Exam paper</Label>
          <EntryPicker
            entryId={entryId}
            entryIds={fixRequest.conflict.affectedEntryIds}
            onChange={setEntryId}
            resolveEntryLabel={resolveEntryLabel}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <CustomDatePicker
              label="Date"
              value={date ? new Date(`${date}T00:00:00`) : null}
              onChange={(value) => setDate(value ? value.toISOString().slice(0, 10) : "")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fix-start">Start time</Label>
            <Input
              id="fix-start"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              placeholder="08:00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fix-end">End time</Label>
            <Input
              id="fix-end"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              placeholder="10:00"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={updateEntry.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          onClick={() => void handleSave()}
          disabled={updateEntry.isPending || !entry}
        >
          {updateEntry.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Clock3 className="mr-2 h-4 w-4" />
              Save time
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}

function ExamConflictVenueModal({
  open,
  session,
  entries,
  fixRequest,
  onOpenChange,
  onFixed,
  resolveEntryLabel,
}: {
  open: boolean;
  session: ExamSessionDTO;
  entries: ExamTimetableEntryDTO[];
  fixRequest: ConflictFixRequest;
  onOpenChange: (open: boolean) => void;
  onFixed: () => void;
  resolveEntryLabel: (entryId: string) => string;
}) {
  const busy = useBusyToast();
  const updateEntry = useUpdateExamTimetableEntry(session.id);
  const { data: venuesData } = useExamVenues({ activeOnly: true });
  const [entryId, setEntryId] = React.useState(fixRequest.entryId);
  const entry = entries.find((row) => row.id === entryId);
  const [venueId, setVenueId] = React.useState("");
  const [roomLabel, setRoomLabel] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setEntryId(fixRequest.entryId);
    const selected = entries.find((row) => row.id === fixRequest.entryId);
    if (!selected) return;
    setVenueId(selected.venueId ?? "");
    setRoomLabel(selected.roomLabel ?? "");
  }, [open, fixRequest.entryId, entries]);

  React.useEffect(() => {
    if (!entry) return;
    setVenueId(entry.venueId ?? "");
    setRoomLabel(entry.roomLabel ?? "");
  }, [entry?.id]);

  async function handleSave() {
    if (!entry) return;
    if (!venueId && !roomLabel.trim()) {
      busy.error("Select a venue or enter a room label.");
      return;
    }

    await busy.promise(
      updateEntry.mutateAsync({
        entryId: entry.id,
        input: {
          venueId: venueId ? venueId : null,
          roomLabel: roomLabel.trim() ? roomLabel.trim() : null,
        },
      }),
      {
        loading: "Updating venue…",
        success: "Venue updated",
        error: (error) =>
          error instanceof Error ? error.message : "Could not update venue",
      }
    );

    onOpenChange(false);
    onFixed();
  }

  const venues = venuesData?.data ?? [];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={fixRequest.conflict.type === "missing_venue" ? "Add venue" : "Change venue"}
      description="Assign a venue or room label for the affected exam paper."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/70">Exam paper</Label>
          <EntryPicker
            entryId={entryId}
            entryIds={fixRequest.conflict.affectedEntryIds}
            onChange={setEntryId}
            resolveEntryLabel={resolveEntryLabel}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Venue</Label>
            <PremiumSelect
              value={venueId || "none"}
              onValueChange={(value) => setVenueId(value === "none" ? "" : value)}
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
            <Label htmlFor="fix-room">Room label</Label>
            <Input
              id="fix-room"
              value={roomLabel}
              onChange={(event) => setRoomLabel(event.target.value)}
              placeholder="Room 4"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className={glassSecondaryButtonClass}
          onClick={() => onOpenChange(false)}
          disabled={updateEntry.isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className={glassPrimaryButtonClass}
          onClick={() => void handleSave()}
          disabled={updateEntry.isPending || !entry}
        >
          {updateEntry.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Save venue
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}

function ExamConflictInvigilatorModal({
  open,
  session,
  fixRequest,
  onOpenChange,
  onFixed,
  resolveEntryLabel,
}: {
  open: boolean;
  session: ExamSessionDTO;
  entries: ExamTimetableEntryDTO[];
  fixRequest: ConflictFixRequest;
  onOpenChange: (open: boolean) => void;
  onFixed: () => void;
  resolveEntryLabel: (entryId: string) => string;
}) {
  const busy = useBusyToast();
  const isReplace = fixRequest.action === "replace_invigilator";
  const assignInvigilator = useAssignExamInvigilator(session.id);
  const replaceInvigilator = useReplaceExamInvigilator(session.id);
  const [entryId, setEntryId] = React.useState(fixRequest.entryId);
  const [teacherOpen, setTeacherOpen] = React.useState(false);
  const [teacherQuery, setTeacherQuery] = React.useState("");
  const [selectedTeacherId, setSelectedTeacherId] = React.useState<string | null>(null);
  const [selectedTeacherLabel, setSelectedTeacherLabel] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<ExamInvigilatorRole>("lead");

  const debouncedQuery = useDebouncedValue(teacherQuery, 250);
  const teachersQuery = useTeacherSearch(debouncedQuery);

  const { data: assignmentsData } = useExamInvigilatorAssignments(session.id, {
    entryId,
  });
  const assignments = assignmentsData?.data ?? [];
  const assignmentToReplace = React.useMemo(() => {
    if (!isReplace || !fixRequest.teacherId) return null;
    return (
      assignments.find(
        (row) =>
          row.teacherId === fixRequest.teacherId &&
          (row.status === "assigned" || row.status === "acknowledged")
      ) ?? null
    );
  }, [assignments, fixRequest.teacherId, isReplace]);

  React.useEffect(() => {
    if (!open) return;
    setEntryId(fixRequest.entryId);
    setTeacherQuery("");
    setSelectedTeacherId(null);
    setSelectedTeacherLabel(null);
    setRole("lead");
    setTeacherOpen(false);
  }, [open, fixRequest.entryId]);

  async function handleSave() {
    if (!selectedTeacherId) {
      busy.error("Select a teacher.");
      return;
    }

    if (isReplace) {
      if (!assignmentToReplace) {
        busy.error("Could not find the invigilator assignment to replace.");
        return;
      }

      await busy.promise(
        replaceInvigilator.mutateAsync({
          assignmentId: assignmentToReplace.id,
          teacherId: selectedTeacherId,
          role,
        }),
        {
          loading: "Replacing invigilator…",
          success: "Invigilator replaced",
          error: (error) =>
            error instanceof Error ? error.message : "Could not replace invigilator",
        }
      );
    } else {
      await busy.promise(
        assignInvigilator.mutateAsync({
          examTimetableEntryId: entryId,
          teacherId: selectedTeacherId,
          role,
        }),
        {
          loading: "Assigning invigilator…",
          success: "Invigilator assigned",
          error: (error) =>
            error instanceof Error ? error.message : "Could not assign invigilator",
        }
      );
    }

    onOpenChange(false);
    onFixed();
  }

  const isSaving = assignInvigilator.isPending || replaceInvigilator.isPending;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={isReplace ? "Replace invigilator" : "Add invigilator"}
      description={
        isReplace
          ? "Choose a different teacher for the overlapping invigilation duty."
          : "Assign a teacher to invigilate this exam paper."
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-white/70">Exam paper</Label>
          <EntryPicker
            entryId={entryId}
            entryIds={fixRequest.conflict.affectedEntryIds}
            onChange={setEntryId}
            resolveEntryLabel={resolveEntryLabel}
          />
        </div>

        {isReplace && !assignmentToReplace ? (
          <div className={cn(glassInsetClass, "p-3 text-sm text-amber-100")}>
            Select the exam paper that contains the overlapping invigilator assignment.
          </div>
        ) : null}

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
                    <div className="px-3 py-3 text-sm text-neutral-400">Searching…</div>
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
                              <span className="truncate text-sm">{teacher.fullName}</span>
                            </div>
                            {selectedTeacherId === teacher.id ? (
                              <Check className="h-4 w-4 text-neutral-300" />
                            ) : null}
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
              {INVIGILATOR_ROLES.map((item) => (
                <PremiumSelectItem key={item} value={item}>
                  {ROLE_LABELS[item]}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
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
          onClick={() => void handleSave()}
          disabled={isSaving || (isReplace && !assignmentToReplace)}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              {isReplace ? "Replace invigilator" : "Assign invigilator"}
            </>
          )}
        </Button>
      </div>
    </ResponsiveModal>
  );
}
