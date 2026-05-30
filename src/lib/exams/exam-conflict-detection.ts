import type {
  ExamConflictDTO,
  ExamConflictType,
} from "@/types/academics/exam-scheduling-engine";
import { parseTimeToMinutes, slotsOverlap } from "@/lib/timetable/validate";

export type ExamConflictDetectionEntry = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  venueId: string | null;
  roomLabel: string | null;
  classGroupIds: string[];
  status: string;
  isUnscheduled: boolean;
};

export type ExamConflictDetectionInvigilator = {
  id: string;
  examTimetableEntryId: string;
  teacherId: string;
  status: string;
};

export type ExamConflictDetectionPolicy = {
  requireVenue: boolean;
  requireInvigilator: boolean;
  preventRoomDoubleBooking: boolean;
  preventClassExamOverlap: boolean;
  preventTeacherInvigilationOverlap: boolean;
  allowConflictOverride: boolean;
};

export type ExamConflictDetectionSession = {
  startDate: string;
  endDate: string;
};

export type DetectExamSessionConflictsInput = {
  session: ExamConflictDetectionSession;
  entries: ExamConflictDetectionEntry[];
  invigilators: ExamConflictDetectionInvigilator[];
  policy: ExamConflictDetectionPolicy;
};

const ACTIVE_INVIGILATOR_STATUSES = new Set(["assigned", "acknowledged"]);
const EXCLUDED_ENTRY_STATUSES = new Set(["cancelled"]);

interface ScheduledEntry extends ExamConflictDetectionEntry {
  dateKey: string;
}

interface TimeIndexedSlot {
  entryId: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

function toDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function isScheduledEntry(entry: ExamConflictDetectionEntry): entry is ScheduledEntry {
  if (entry.isUnscheduled || EXCLUDED_ENTRY_STATUSES.has(entry.status)) return false;
  return (
    parseTimeToMinutes(entry.startTime) !== null &&
    parseTimeToMinutes(entry.endTime) !== null
  );
}

function buildConflict(input: {
  type: ExamConflictType;
  key: string;
  message: string;
  suggestion: string;
  canOverride: boolean;
  affectedEntryIds?: string[];
  affectedTeacherIds?: string[];
  affectedClassGroupIds?: string[];
  affectedVenueIds?: string[];
}): ExamConflictDTO {
  return {
    key: input.key,
    type: input.type,
    severity: "error",
    message: input.message,
    affectedEntryIds: input.affectedEntryIds ?? [],
    affectedTeacherIds: input.affectedTeacherIds ?? [],
    affectedClassGroupIds: input.affectedClassGroupIds ?? [],
    affectedVenueIds: input.affectedVenueIds ?? [],
    suggestion: input.suggestion,
    canOverride: input.canOverride,
  };
}

function toTimeIndexedSlot(entry: ScheduledEntry): TimeIndexedSlot | null {
  const startMinutes = parseTimeToMinutes(entry.startTime);
  const endMinutes = parseTimeToMinutes(entry.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return {
    entryId: entry.id,
    dateKey: entry.dateKey,
    startTime: entry.startTime,
    endTime: entry.endTime,
    startMinutes,
    endMinutes,
  };
}

function addPairOverlapConflicts(input: {
  type: Extract<ExamConflictType, "class_overlap" | "room_overlap">;
  grouped: Map<string, TimeIndexedSlot[]>;
  canOverride: boolean;
  buildMessage: (
    slotA: TimeIndexedSlot,
    slotB: TimeIndexedSlot,
    resourceId: string
  ) => { message: string; suggestion: string; resourceIds?: string[] };
  output: ExamConflictDTO[];
  seen: Set<string>;
}) {
  for (const [groupKey, items] of input.grouped.entries()) {
    const sorted = [...items].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
      return a.entryId.localeCompare(b.entryId);
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const slotA = sorted[i];
        const slotB = sorted[j];
        if (slotB.startMinutes >= slotA.endMinutes) break;
        if (
          !slotsOverlap(
            { startTime: slotA.startTime, endTime: slotA.endTime },
            { startTime: slotB.startTime, endTime: slotB.endTime }
          )
        ) {
          continue;
        }

        const entryIds = [slotA.entryId, slotB.entryId].sort((a, b) => a.localeCompare(b));
        const dedupeKey = `${input.type}|${groupKey}|${entryIds[0]}|${entryIds[1]}`;
        if (input.seen.has(dedupeKey)) continue;
        input.seen.add(dedupeKey);

        const copy = input.buildMessage(slotA, slotB, groupKey.split("|")[0] ?? groupKey);
        input.output.push(
          buildConflict({
            type: input.type,
            key: dedupeKey,
            message: copy.message,
            suggestion: copy.suggestion,
            canOverride: input.canOverride,
            affectedEntryIds: entryIds,
            affectedClassGroupIds:
              input.type === "class_overlap" ? [groupKey.split("|")[0] ?? ""] : [],
            affectedVenueIds:
              input.type === "room_overlap" ? copy.resourceIds ?? [] : [],
          })
        );
      }
    }
  }
}

function detectInvalidDurationConflicts(
  entries: ExamConflictDetectionEntry[],
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  for (const entry of entries) {
    if (EXCLUDED_ENTRY_STATUSES.has(entry.status)) continue;

    const startMinutes = parseTimeToMinutes(entry.startTime);
    const endMinutes = parseTimeToMinutes(entry.endTime);
    const hasInvalidDuration =
      !entry.durationMinutes ||
      entry.durationMinutes < 1 ||
      (!entry.isUnscheduled &&
        (startMinutes === null ||
          endMinutes === null ||
          endMinutes <= startMinutes ||
          entry.durationMinutes !== endMinutes - startMinutes));

    if (!hasInvalidDuration) continue;

    const key = `invalid_duration|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push(
      buildConflict({
        type: "invalid_duration",
        key,
        message: entry.isUnscheduled
          ? "This exam paper has an invalid duration."
          : "This exam paper has an invalid start time, end time, or duration.",
        suggestion: "Set a valid duration and matching start/end times.",
        canOverride: false,
        affectedEntryIds: [entry.id],
      })
    );
  }
}

function detectOutsideSessionRangeConflicts(
  session: ExamConflictDetectionSession,
  entries: ExamConflictDetectionEntry[],
  allowConflictOverride: boolean,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  const startKey = toDateKey(session.startDate);
  const endKey = toDateKey(session.endDate);

  for (const entry of entries) {
    if (!isScheduledEntry(entry)) continue;

    const dateKey = toDateKey(entry.date);
    if (dateKey >= startKey && dateKey <= endKey) continue;

    const key = `outside_session_range|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push(
      buildConflict({
        type: "outside_session_range",
        key,
        message: "This exam paper is scheduled outside the exam session date range.",
        suggestion: "Move the exam date within the session start and end dates.",
        canOverride: allowConflictOverride,
        affectedEntryIds: [entry.id],
      })
    );
  }
}

function detectMissingVenueConflicts(
  entries: ExamConflictDetectionEntry[],
  policy: ExamConflictDetectionPolicy,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  if (!policy.requireVenue) return;

  for (const entry of entries) {
    if (EXCLUDED_ENTRY_STATUSES.has(entry.status) || entry.isUnscheduled) continue;
    if (entry.venueId || entry.roomLabel?.trim()) continue;

    const key = `missing_venue|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push(
      buildConflict({
        type: "missing_venue",
        key,
        message: "This exam paper does not have a venue assigned.",
        suggestion: "Add a venue or room label for this exam paper.",
        canOverride: policy.allowConflictOverride,
        affectedEntryIds: [entry.id],
      })
    );
  }
}

function detectMissingInvigilatorConflicts(
  entries: ExamConflictDetectionEntry[],
  invigilators: ExamConflictDetectionInvigilator[],
  policy: ExamConflictDetectionPolicy,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  if (!policy.requireInvigilator) return;

  const activeByEntry = new Map<string, number>();
  for (const row of invigilators) {
    if (!ACTIVE_INVIGILATOR_STATUSES.has(row.status)) continue;
    activeByEntry.set(
      row.examTimetableEntryId,
      (activeByEntry.get(row.examTimetableEntryId) ?? 0) + 1
    );
  }

  for (const entry of entries) {
    if (EXCLUDED_ENTRY_STATUSES.has(entry.status) || entry.isUnscheduled) continue;
    if ((activeByEntry.get(entry.id) ?? 0) > 0) continue;

    const key = `missing_invigilator|${entry.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    output.push(
      buildConflict({
        type: "missing_invigilator",
        key,
        message: "This exam paper does not have an invigilator assigned.",
        suggestion: "Assign at least one invigilator to this exam paper.",
        canOverride: policy.allowConflictOverride,
        affectedEntryIds: [entry.id],
      })
    );
  }
}

function detectClassOverlapConflicts(
  scheduledEntries: ScheduledEntry[],
  policy: ExamConflictDetectionPolicy,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  if (!policy.preventClassExamOverlap) return;

  const grouped = new Map<string, TimeIndexedSlot[]>();
  for (const entry of scheduledEntries) {
    const slot = toTimeIndexedSlot({ ...entry, dateKey: toDateKey(entry.date) });
    if (!slot) continue;

    for (const classGroupId of entry.classGroupIds) {
      const groupKey = `${classGroupId}|${slot.dateKey}`;
      const items = grouped.get(groupKey) ?? [];
      items.push(slot);
      grouped.set(groupKey, items);
    }
  }

  addPairOverlapConflicts({
    type: "class_overlap",
    grouped,
    canOverride: policy.allowConflictOverride,
    buildMessage: (_slotA, _slotB, classGroupId) => ({
      message: "A class group has overlapping exam papers scheduled at the same time.",
      suggestion: "Reschedule one of the overlapping exam papers to a different time.",
      resourceIds: [classGroupId],
    }),
    output,
    seen,
  });
}

function detectRoomOverlapConflicts(
  scheduledEntries: ScheduledEntry[],
  policy: ExamConflictDetectionPolicy,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  if (!policy.preventRoomDoubleBooking) return;

  const grouped = new Map<string, TimeIndexedSlot[]>();
  for (const entry of scheduledEntries) {
    const slot = toTimeIndexedSlot({ ...entry, dateKey: toDateKey(entry.date) });
    if (!slot) continue;

    const roomKey = entry.venueId
      ? `venue:${entry.venueId}`
      : entry.roomLabel?.trim()
        ? `room:${entry.roomLabel.trim().toLowerCase()}`
        : null;
    if (!roomKey) continue;

    const groupKey = `${roomKey}|${slot.dateKey}`;
    const items = grouped.get(groupKey) ?? [];
    items.push(slot);
    grouped.set(groupKey, items);
  }

  addPairOverlapConflicts({
    type: "room_overlap",
    grouped,
    canOverride: policy.allowConflictOverride,
    buildMessage: (_slotA, _slotB, roomKey) => ({
      message: "A venue is double-booked for overlapping exam papers.",
      suggestion: "Choose a different venue or adjust one of the exam times.",
      resourceIds: roomKey.startsWith("venue:") ? [roomKey.slice("venue:".length)] : [],
    }),
    output,
    seen,
  });
}

function detectTeacherOverlapConflicts(
  scheduledEntries: ScheduledEntry[],
  invigilators: ExamConflictDetectionInvigilator[],
  policy: ExamConflictDetectionPolicy,
  output: ExamConflictDTO[],
  seen: Set<string>
) {
  if (!policy.preventTeacherInvigilationOverlap) return;

  const entryById = new Map(scheduledEntries.map((entry) => [entry.id, entry]));
  const grouped = new Map<string, TimeIndexedSlot[]>();

  for (const assignment of invigilators) {
    if (!ACTIVE_INVIGILATOR_STATUSES.has(assignment.status)) continue;
    const entry = entryById.get(assignment.examTimetableEntryId);
    if (!entry) continue;

    const slot = toTimeIndexedSlot({ ...entry, dateKey: toDateKey(entry.date) });
    if (!slot) continue;

    const groupKey = `${assignment.teacherId}|${slot.dateKey}`;
    const items = grouped.get(groupKey) ?? [];
    items.push(slot);
    grouped.set(groupKey, items);
  }

  for (const [groupKey, items] of grouped.entries()) {
    const teacherId = groupKey.split("|")[0] ?? "";
    const sorted = [...items].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
      return a.entryId.localeCompare(b.entryId);
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const slotA = sorted[i];
        const slotB = sorted[j];
        if (slotB.startMinutes >= slotA.endMinutes) break;
        if (
          !slotsOverlap(
            { startTime: slotA.startTime, endTime: slotA.endTime },
            { startTime: slotB.startTime, endTime: slotB.endTime }
          )
        ) {
          continue;
        }

        const entryIds = [slotA.entryId, slotB.entryId].sort((a, b) => a.localeCompare(b));
        const dedupeKey = `teacher_overlap|${teacherId}|${entryIds[0]}|${entryIds[1]}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        output.push(
          buildConflict({
            type: "teacher_overlap",
            key: dedupeKey,
            message: "A teacher has overlapping invigilation duties scheduled at the same time.",
            suggestion: "Assign a different invigilator or change one of the exam times.",
            canOverride: policy.allowConflictOverride,
            affectedEntryIds: entryIds,
            affectedTeacherIds: [teacherId],
          })
        );
      }
    }
  }
}

export function detectExamSessionConflicts(
  input: DetectExamSessionConflictsInput
): ExamConflictDTO[] {
  const activeEntries = input.entries.filter(
    (entry) => !EXCLUDED_ENTRY_STATUSES.has(entry.status)
  );
  const scheduledEntries = activeEntries.filter(isScheduledEntry).map((entry) => ({
    ...entry,
    dateKey: toDateKey(entry.date),
  }));

  const output: ExamConflictDTO[] = [];
  const seen = new Set<string>();

  detectInvalidDurationConflicts(activeEntries, output, seen);
  detectOutsideSessionRangeConflicts(
    input.session,
    activeEntries,
    input.policy.allowConflictOverride,
    output,
    seen
  );
  detectMissingVenueConflicts(activeEntries, input.policy, output, seen);
  detectMissingInvigilatorConflicts(
    activeEntries,
    input.invigilators,
    input.policy,
    output,
    seen
  );
  detectClassOverlapConflicts(scheduledEntries, input.policy, output, seen);
  detectRoomOverlapConflicts(scheduledEntries, input.policy, output, seen);
  detectTeacherOverlapConflicts(
    scheduledEntries,
    input.invigilators,
    input.policy,
    output,
    seen
  );

  output.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.key.localeCompare(b.key);
  });

  return output;
}

export function groupExamConflictsBySeverity(conflicts: ExamConflictDTO[]) {
  const grouped = {
    errors: [] as ExamConflictDTO[],
    warnings: [] as ExamConflictDTO[],
    info: [] as ExamConflictDTO[],
  };

  for (const conflict of conflicts) {
    if (conflict.severity === "warning") grouped.warnings.push(conflict);
    else if (conflict.severity === "info") grouped.info.push(conflict);
    else grouped.errors.push(conflict);
  }

  return grouped;
}

export function computeExamReadinessScore(input: {
  errorCount: number;
  warningCount: number;
  entryCount: number;
}): number {
  if (input.entryCount <= 0) return 0;
  const score = 100 - input.errorCount * 15 - input.warningCount * 5;
  return Math.max(0, Math.min(100, score));
}

export type StoredConflictOverride = {
  key: string;
  overriddenBy?: string | null;
  overrideReason?: string | null;
  overriddenAt?: string | null;
};

export function mergeConflictOverrides(
  liveConflicts: ExamConflictDTO[],
  storedOverrides: StoredConflictOverride[]
): ExamConflictDTO[] {
  const overrideMap = new Map(
    storedOverrides
      .filter((row) => row.overriddenBy)
      .map((row) => [row.key, row])
  );

  return liveConflicts.map((conflict) => {
    const override = overrideMap.get(conflict.key);
    if (!override?.overriddenBy) return conflict;

    return {
      ...conflict,
      isOverridden: true,
      overriddenBy: override.overriddenBy ?? null,
      overrideReason: override.overrideReason ?? null,
      overriddenAt: override.overriddenAt ?? null,
    };
  });
}

export function summarizeActiveConflicts(conflicts: ExamConflictDTO[]) {
  const activeConflicts = conflicts.filter((conflict) => !conflict.isOverridden);
  const grouped = groupExamConflictsBySeverity(activeConflicts);

  return {
    activeConflicts,
    grouped,
    overriddenCount: conflicts.filter((conflict) => conflict.isOverridden).length,
  };
}
