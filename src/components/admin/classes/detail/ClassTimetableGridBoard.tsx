"use client";

import * as React from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Loader2, Trash2, User, Coffee, Sun, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCreateClassSlot,
  useDeleteClassSlot,
  useUpdateClassSlot,
  type ClassTimetableSlotDTO,
} from "@/hooks/admin/useClassTimetableSlots";
import { formatTimeLabel } from "@/components/admin/timetable/types";
import { DAY_NAMES } from "@/components/admin/timetable/types";
import type { TimetableValidationIssue } from "@/hooks/admin/useTimetablePlanner";
import type { ClassSubjectTeacherRow } from "@/hooks/admin/useClassSubjectTeachers";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { UnallocatedGapActions } from "@/components/admin/classes/detail/UnallocatedGapActions";

const NO_TEACHER_TOKEN = "__none__";

function cellId(day: number, startTime: string, endTime: string) {
  return `cell|${day}|${startTime}|${endTime}`;
}

function parseCellId(id: string): { day: number; startTime: string; endTime: string } | null {
  if (!id.startsWith("cell|")) return null;
  const parts = id.split("|");
  if (parts.length !== 4) return null;
  return { day: Number(parts[1]), startTime: parts[2], endTime: parts[3] };
}

function slotDragId(slotId: string) {
  return `slot|${slotId}`;
}

function paletteDragId(subjectId: string, teacherId: string | null) {
  return `palette|${subjectId}|${teacherId || NO_TEACHER_TOKEN}`;
}

function getIssuesFromError(error: unknown): TimetableValidationIssue[] {
  const candidate = error as Error & { issues?: TimetableValidationIssue[] };
  return Array.isArray(candidate.issues) ? candidate.issues : [];
}

export type TimelineRow =
  | {
      kind: "period";
      periodNumber: number;
      startTime: string;
      endTime: string;
      label: string;
    }
  | { kind: "break"; name: string; startTime: string; endTime: string }
  | { kind: "opening"; name: string; startTime: string; endTime: string }
  | { kind: "unallocated"; label: string; startTime: string; endTime: string };

function formatTimelineNeighborLabel(
  row: TimelineRow | undefined,
  position: "before" | "after"
): string {
  if (!row) {
    return position === "before" ? "Start of the teaching day window" : "End of the teaching day";
  }
  switch (row.kind) {
    case "period":
      return `Period ${row.periodNumber} (${row.startTime}–${row.endTime})`;
    case "break":
      return `Break: ${row.name} (${row.startTime}–${row.endTime})`;
    case "opening":
      return `Opening: ${row.name} (${row.startTime}–${row.endTime})`;
    case "unallocated":
      return `Unallocated (${row.startTime}–${row.endTime})`;
    default:
      return "Adjacent block";
  }
}

type ClassTimetableGridBoardProps = {
  classId: string;
  className: string;
  academicPeriodId: string;
  /** One day per wizard step, or full week for review. */
  mode: "day" | "review";
  /** When mode is day, the weekday being edited (0–6). */
  activeDayOfWeek: number | null;
  workingDays: number[];
  getTimelineForDay: (dayOfWeek: number) => TimelineRow[];
  classSubjects: ClassSubjectTeacherRow[];
  slots: ClassTimetableSlotDTO[];
  subjectMap: Map<string, { id: string; name: string; code: string | null }>;
  teacherMap: Map<string, string>;
  slotIssueSeverityById?: Map<string, "error" | "warning">;
  onSlotsChanged: () => void;
  /** Unallocated-row actions: presets + Leo (defaults to admin daily schedules tab). */
  dailyScheduleSettingsHref?: string;
};

function DraggableSlot({
  slot,
  disabled,
  children,
}: {
  slot: ClassTimetableSlotDTO;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slotDragId(slot.id),
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        className="absolute left-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/35 hover:bg-white/10 hover:text-white/70"
        {...listeners}
        {...attributes}
        aria-label="Drag to move lesson"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function DroppableCell({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[88px] rounded-xl border border-dashed border-white/15 bg-white/[0.04] p-2.5 transition-colors",
        isOver && "border-cyan-400/50 bg-cyan-500/10",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ClassTimetableGridBoard({
  classId,
  className,
  academicPeriodId,
  mode,
  activeDayOfWeek,
  workingDays,
  getTimelineForDay,
  classSubjects,
  slots,
  subjectMap,
  teacherMap,
  slotIssueSeverityById,
  onSlotsChanged,
  dailyScheduleSettingsHref = "/admin/settings?tab=dailySchedule",
}: ClassTimetableGridBoardProps) {
  const createMutation = useCreateClassSlot(classId);
  const updateMutation = useUpdateClassSlot(classId);
  const deleteMutation = useDeleteClassSlot(classId);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const slotsByCellKey = React.useMemo(() => {
    const m = new Map<string, ClassTimetableSlotDTO[]>();
    for (const s of slots) {
      const key = `${s.dayOfWeek}|${s.startTime}|${s.endTime}`;
      const list = m.get(key) || [];
      list.push(s);
      m.set(key, list);
    }
    return m;
  }, [slots]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overParsed = parseCellId(String(over.id));
    if (!overParsed) return;

    const activeStr = String(active.id);
    if (activeStr.startsWith("palette|")) {
      const parts = activeStr.split("|");
      const subjectId = parts[1];
      const teacherToken = parts[2];
      const teacherId =
        !teacherToken || teacherToken === NO_TEACHER_TOKEN ? null : teacherToken;
      if (!subjectId) {
        toast.error("Invalid subject.");
        return;
      }
      try {
        await createMutation.mutateAsync({
          academicPeriodId,
          dayOfWeek: overParsed.day,
          startTime: overParsed.startTime,
          endTime: overParsed.endTime,
          subjectId,
          teacherId,
        });
        toast.success("Lesson added");
        onSlotsChanged();
      } catch (e) {
        const issues = getIssuesFromError(e);
        const msg = e instanceof Error ? e.message : "Could not add lesson";
        toast.error(issues[0]?.message || msg);
      }
      return;
    }

    if (activeStr.startsWith("slot|")) {
      const slotId = activeStr.slice(5);
      const existing = slots.find((s) => s.id === slotId);
      if (!existing) return;
      if (
        existing.dayOfWeek === overParsed.day &&
        existing.startTime === overParsed.startTime &&
        existing.endTime === overParsed.endTime
      ) {
        return;
      }
      const cellSlots = slotsByCellKey.get(
        `${overParsed.day}|${overParsed.startTime}|${overParsed.endTime}`
      );
      if (cellSlots?.some((s) => s.id !== slotId)) {
        toast.error("This period already has a lesson. Remove it first or swap elsewhere.");
        return;
      }
      try {
        await updateMutation.mutateAsync({
          slotId,
          payload: {
            dayOfWeek: overParsed.day,
            startTime: overParsed.startTime,
            endTime: overParsed.endTime,
          },
        });
        toast.success("Lesson moved");
        onSlotsChanged();
      } catch (e) {
        const issues = getIssuesFromError(e);
        toast.error(issues[0]?.message || (e instanceof Error ? e.message : "Move failed"));
      }
    }
  };

  const handleDelete = async (slot: ClassTimetableSlotDTO) => {
    const decision = await confirm({
      title: "Remove this lesson?",
      description:
        "This will remove the lesson from this class’s timetable draft. You can add it again by dragging the subject into a period.",
      confirmLabel: "Remove lesson",
      cancelLabel: "Keep lesson",
      intent: "destructive",
      zIndexClass: "z-[100]",
    });
    if (decision !== "confirm") return;
    try {
      await deleteMutation.mutateAsync(slot.id);
      toast.success("Removed");
      onSlotsChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const busy =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const daysToRender =
    mode === "day" && activeDayOfWeek !== null ? [activeDayOfWeek] : workingDays;

  const renderDay = (day: number) => {
    const timeline = getTimelineForDay(day);
    return (
      <div
        key={day}
        className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3">
          <span className="font-medium text-white">{DAY_NAMES[day]}</span>
          {timeline.length > 0 ? (
            <span className="text-xs text-white/45">
              {timeline.filter((row) => row.kind === "period").length} teaching block(s)
            </span>
          ) : null}
        </div>
        <div className="divide-y divide-white/10">
          {timeline.length === 0 ? (
            <p className="p-4 text-sm text-amber-200/90">
              No periods resolved for this day — check school settings, breaks, and grade
              overrides for {className}.
            </p>
          ) : (
            timeline.map((row, idx) => {
              if (row.kind === "break") {
                return (
                  <div
                    key={`br-${day}-${idx}`}
                    className="grid gap-0 lg:grid-cols-[190px_minmax(0,1fr)]"
                  >
                    <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/90 lg:border-r lg:border-amber-500/15">
                      <span className="flex items-center gap-2 font-medium">
                        <Coffee className="h-4 w-4 shrink-0 text-amber-300" />
                        {row.name}
                      </span>
                      <span className="mt-1 block text-xs text-amber-200/70">
                        {formatTimeLabel(row.startTime)} – {formatTimeLabel(row.endTime)}
                      </span>
                    </div>
                    <div className="border-t border-amber-500/10 bg-amber-500/5 px-3 py-3 text-xs leading-relaxed text-amber-100/60 lg:border-l-0">
                      Break (school settings) — not a teaching period
                    </div>
                  </div>
                );
              }

              if (row.kind === "opening") {
                return (
                  <div
                    key={`op-${day}-${idx}`}
                    className="grid gap-0 lg:grid-cols-[190px_minmax(0,1fr)]"
                  >
                    <div className="border-t border-amber-400/20 bg-amber-400/5 px-3 py-3 text-sm text-amber-50/90 lg:border-r lg:border-amber-400/15">
                      <span className="flex items-center gap-2 font-medium">
                        <Sun className="h-4 w-4 shrink-0 text-amber-200" />
                        {row.name}
                      </span>
                      <span className="mt-1 block text-xs text-amber-100/60">
                        {formatTimeLabel(row.startTime)} – {formatTimeLabel(row.endTime)}
                      </span>
                    </div>
                    <div className="border-t border-amber-400/10 bg-amber-950/20 px-3 py-3 text-xs leading-relaxed text-amber-100/55 lg:border-l-0">
                      Non-teaching (opening) — not on the class timetable; lessons start at Period 1.
                    </div>
                  </div>
                );
              }

              if (row.kind === "unallocated") {
                return (
                  <div
                    key={`slack-${day}-${idx}`}
                    className="grid gap-0 lg:grid-cols-[190px_minmax(0,1fr)]"
                  >
                    <div className="border-t border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/50 lg:border-r lg:border-white/10">
                      <span className="flex items-center gap-2 font-medium text-white/65">
                        <Hourglass className="h-4 w-4 shrink-0 text-white/35" />
                        {row.label}
                      </span>
                      <span className="mt-1 block text-xs text-white/40">
                        {formatTimeLabel(row.startTime)} – {formatTimeLabel(row.endTime)}
                      </span>
                    </div>
                    <div className="border-t border-white/5 bg-white/[0.02] px-3 py-3 lg:border-l-0">
                      <UnallocatedGapActions
                        classId={classId}
                        academicPeriodId={academicPeriodId}
                        dayOfWeek={day}
                        startTime={row.startTime}
                        endTime={row.endTime}
                        dailyScheduleSettingsHref={dailyScheduleSettingsHref}
                        beforeBlockLabel={formatTimelineNeighborLabel(
                          timeline[idx - 1],
                          "before"
                        )}
                        afterBlockLabel={formatTimelineNeighborLabel(
                          timeline[idx + 1],
                          "after"
                        )}
                      />
                    </div>
                  </div>
                );
              }

              const cid = cellId(day, row.startTime, row.endTime);
              const key = `${day}|${row.startTime}|${row.endTime}`;
              const cellSlots = slotsByCellKey.get(key) || [];

              return (
                <div
                  key={`${day}-${row.periodNumber}-${row.startTime}`}
                  className="grid gap-0 lg:grid-cols-[190px_minmax(0,1fr)]"
                >
                  <div className="border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-white/70 lg:border-r">
                    <span className="block font-medium text-white/90">{row.label}</span>
                    <span className="mt-1 block text-xs text-white/45">
                      {formatTimeLabel(row.startTime)} – {formatTimeLabel(row.endTime)}
                    </span>
                  </div>
                  <DroppableCell id={cid} className="border-white/5 lg:border-l-0">
                    {cellSlots.length === 0 ? (
                      <p className="py-5 text-center text-xs text-white/35">
                        Drop a subject card here
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {cellSlots.map((slot) => {
                          const subject = subjectMap.get(slot.subjectId);
                          const assignedTeachers =
                            classSubjects.find((row) => row.subjectId === slot.subjectId)
                              ?.teachers || [];
                          const teacherName = slot.teacherId
                            ? teacherMap.get(slot.teacherId) || "—"
                            : assignedTeachers.length === 1
                              ? assignedTeachers[0].fullName
                              : assignedTeachers.length > 1
                                ? `${assignedTeachers.length} teachers assigned`
                                : "Teacher not assigned yet";
                          const issueSeverity = slotIssueSeverityById?.get(slot.id);
                          return (
                            <DraggableSlot key={slot.id} slot={slot} disabled={busy}>
                              <div
                                className={cn(
                                  "flex min-w-0 items-start justify-between gap-2 rounded-xl border bg-white/5 py-2.5 pl-1 pr-2.5",
                                  issueSeverity === "error"
                                    ? "border-rose-400/50 bg-rose-500/10 shadow-[0_0_0_1px_rgba(251,113,133,0.12)]"
                                    : issueSeverity === "warning"
                                      ? "border-amber-400/45 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.1)]"
                                      : "border-white/10"
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <p className="min-w-0 break-words text-sm font-medium leading-snug text-white">
                                      {subject?.name || "Subject"}
                                    </p>
                                    {subject?.code ? (
                                      <Badge
                                        variant="outline"
                                        className="shrink-0 border-white/20 text-[10px]"
                                      >
                                        {subject.code}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-white/55">
                                    <User className="h-3 w-3" />
                                    <span className="truncate">{teacherName}</span>
                                  </p>
                                  {issueSeverity ? (
                                    <p
                                      className={cn(
                                        "mt-1 text-[11px] font-medium uppercase tracking-wide",
                                        issueSeverity === "error"
                                          ? "text-rose-200"
                                          : "text-amber-200"
                                      )}
                                    >
                                      Needs review
                                    </p>
                                  ) : null}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 shrink-0 text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                                  onClick={() => handleDelete(slot)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </DraggableSlot>
                          );
                        })}
                      </div>
                    )}
                  </DroppableCell>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <>
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-200/90">
            Class subjects (drag into periods)
          </p>
          <p className="mt-1 text-sm text-white/65">
            Only subjects assigned to this class are shown. The teacher comes from your
            subject–teacher assignments. Subjects without a teacher can still be placed
            and will update when you assign a teacher.
          </p>
          {classSubjects.length === 0 ? (
            <p className="mt-3 text-sm text-amber-200/90">
              No subjects for this class yet — assign subjects under Class → Subjects first.
            </p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {classSubjects.map((row) => {
                const primaryTeacher = row.teachers[0];
                const teacherId = primaryTeacher?.id ?? null;
                const dragId = paletteDragId(row.subjectId, teacherId);
                const label = primaryTeacher
                  ? `${row.subjectName} · ${primaryTeacher.fullName}`
                  : `${row.subjectName} · No teacher yet`;
                return (
                  <DraggablePaletteCard
                    key={row.subjectId}
                    id={dragId}
                    disabled={busy}
                    label={label}
                    warnNoTeacher={!primaryTeacher}
                  />
                );
              })}
            </div>
          )}
        </div>

        {daysToRender.map((d) => renderDay(d))}
      </div>

      {busy ? (
        <div className="pointer-events-none fixed bottom-6 right-6 flex items-center gap-2 rounded-lg border border-white/10 bg-black/80 px-3 py-2 text-sm text-white/80 shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving…
        </div>
      ) : null}
    </DndContext>
    {confirmationDialog}
    </>
  );
}

function DraggablePaletteCard({
  id,
  disabled,
  label,
  warnNoTeacher,
}: {
  id: string;
  disabled?: boolean;
  label: string;
  warnNoTeacher?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={cn(
        "flex min-w-0 w-full max-w-none items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium",
        warnNoTeacher
          ? "border-amber-500/40 bg-amber-500/15 text-amber-50"
          : "border-violet-400/40 bg-violet-500/20 text-violet-100",
        disabled && "cursor-not-allowed opacity-40"
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words leading-snug">{label}</span>
    </button>
  );
}
