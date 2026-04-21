import { Types } from "mongoose";
import type { TimetableConflictCode } from "@/models/TimetableConflict";
import { parseTimeToMinutes, slotsOverlap } from "@/lib/timetable/validate";

export interface TimetableConflictSlot {
  _id?: Types.ObjectId;
  /** Omitted when no teacher is assigned; those slots skip teacher-overlap checks. */
  teacherId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DetectedTimetableConflict {
  code: Extract<TimetableConflictCode, "TEACHER_OVERLAP" | "CLASS_OVERLAP">;
  severity: "error";
  slotIndexes: [number, number];
  slotIds: string[];
  message: string;
  metadata: {
    dayOfWeek: number;
    startTimeA: string;
    endTimeA: string;
    startTimeB: string;
    endTimeB: string;
    teacherId?: string;
    classGroupId?: string;
  };
}

interface IndexedSlot {
  index: number;
  id: string;
  slot: TimetableConflictSlot;
  startMinutes: number;
  endMinutes: number;
}

function toIndexedSlot(slot: TimetableConflictSlot, index: number): IndexedSlot | null {
  const startMinutes = parseTimeToMinutes(slot.startTime);
  const endMinutes = parseTimeToMinutes(slot.endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes ||
    !Number.isInteger(slot.dayOfWeek)
  ) {
    return null;
  }

  return {
    index,
    id: slot._id ? String(slot._id) : `slot-${index}`,
    slot,
    startMinutes,
    endMinutes,
  };
}

function addPairConflicts(
  code: Extract<TimetableConflictCode, "TEACHER_OVERLAP" | "CLASS_OVERLAP">,
  groupedSlots: Map<string, IndexedSlot[]>,
  seen: Set<string>,
  output: DetectedTimetableConflict[]
) {
  const keys = Array.from(groupedSlots.keys()).sort((a, b) => a.localeCompare(b));

  for (const key of keys) {
    const items = groupedSlots.get(key) ?? [];
    items.sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      if (a.endMinutes !== b.endMinutes) return a.endMinutes - b.endMinutes;
      return a.id.localeCompare(b.id);
    });

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (b.startMinutes >= a.endMinutes) break;
        if (!slotsOverlap(a.slot, b.slot)) continue;

        const slotIds = [a.id, b.id].sort((x, y) => x.localeCompare(y));
        const dedupeKey = `${code}|${slotIds[0]}|${slotIds[1]}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const conflict: DetectedTimetableConflict = {
          code,
          severity: "error",
          slotIndexes: [a.index, b.index],
          slotIds,
          message:
            code === "TEACHER_OVERLAP"
              ? "Teacher has overlapping timetable slots."
              : "Class group has overlapping timetable slots.",
          metadata: {
            dayOfWeek: a.slot.dayOfWeek,
            startTimeA: a.slot.startTime,
            endTimeA: a.slot.endTime,
            startTimeB: b.slot.startTime,
            endTimeB: b.slot.endTime,
            teacherId:
              code === "TEACHER_OVERLAP" ? String(a.slot.teacherId) : undefined,
            classGroupId:
              code === "CLASS_OVERLAP" ? String(a.slot.classGroupId) : undefined,
          },
        };

        output.push(conflict);
      }
    }
  }
}

export function detectTimetableConflicts(
  slots: TimetableConflictSlot[]
): DetectedTimetableConflict[] {
  const indexedSlots: IndexedSlot[] = [];
  for (let i = 0; i < slots.length; i++) {
    const indexed = toIndexedSlot(slots[i], i);
    if (indexed) indexedSlots.push(indexed);
  }

  const teacherGroups = new Map<string, IndexedSlot[]>();
  const classGroups = new Map<string, IndexedSlot[]>();

  for (const entry of indexedSlots) {
    const classKey = `${String(entry.slot.classGroupId)}|${entry.slot.dayOfWeek}`;

    const classItems = classGroups.get(classKey) ?? [];
    classItems.push(entry);
    classGroups.set(classKey, classItems);

    const tid = entry.slot.teacherId;
    if (tid) {
      const teacherKey = `${String(tid)}|${entry.slot.dayOfWeek}`;
      const teacherItems = teacherGroups.get(teacherKey) ?? [];
      teacherItems.push(entry);
      teacherGroups.set(teacherKey, teacherItems);
    }
  }

  const output: DetectedTimetableConflict[] = [];
  const seen = new Set<string>();

  addPairConflicts("TEACHER_OVERLAP", teacherGroups, seen, output);
  addPairConflicts("CLASS_OVERLAP", classGroups, seen, output);

  output.sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    if (a.slotIds[0] !== b.slotIds[0]) return a.slotIds[0].localeCompare(b.slotIds[0]);
    return a.slotIds[1].localeCompare(b.slotIds[1]);
  });

  return output;
}
