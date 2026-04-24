import { Types } from "mongoose";
import { TimetableVersion } from "@/models/TimetableVersion";
import { querySlotsForTeacherWithAssignments } from "@/lib/timetable/read-model";

export type AssignmentScheduleItem = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string | null;
};

function toAssignmentKey(
  academicPeriodId: Types.ObjectId | string,
  classGroupId: Types.ObjectId | string,
  subjectId: Types.ObjectId | string
): string {
  return `${String(academicPeriodId)}|${String(classGroupId)}|${String(subjectId)}`;
}

export function durationHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startTotal =
    (Number.isFinite(startHour) ? startHour : 0) * 60 +
    (Number.isFinite(startMinute) ? startMinute : 0);
  const endTotal =
    (Number.isFinite(endHour) ? endHour : 0) * 60 +
    (Number.isFinite(endMinute) ? endMinute : 0);

  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
    return 0;
  }

  return Math.round(((endTotal - startTotal) / 60) * 100) / 100;
}

export function calculateScheduleHours(schedules: AssignmentScheduleItem[]): number {
  const total = schedules.reduce((sum, schedule) => {
    return sum + durationHours(schedule.startTime, schedule.endTime);
  }, 0);
  return Math.round(total * 100) / 100;
}

export function resolveEffectiveWorkloadHours(args: {
  schedules?: AssignmentScheduleItem[] | null;
  contactHoursPerWeek?: number | null;
  workloadHours?: number | null;
}): number {
  const scheduleHours = calculateScheduleHours(args.schedules || []);
  if (scheduleHours > 0) return scheduleHours;
  if (typeof args.contactHoursPerWeek === "number" && args.contactHoursPerWeek > 0) {
    return Math.round(args.contactHoursPerWeek * 100) / 100;
  }
  if (typeof args.workloadHours === "number" && args.workloadHours > 0) {
    return Math.round(args.workloadHours * 100) / 100;
  }
  return 0;
}

export async function buildTeacherScheduleMap(args: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  periodIds: Types.ObjectId[];
}): Promise<Map<string, AssignmentScheduleItem[]>> {
  const scheduleMap = new Map<string, AssignmentScheduleItem[]>();
  if (args.periodIds.length === 0) return scheduleMap;

  const versionsRaw = await TimetableVersion.find({
    schoolId: args.schoolId,
    academicPeriodId: { $in: args.periodIds },
    status: { $in: ["draft", "published"] },
  })
    .sort({ academicPeriodId: 1, status: 1, updatedAt: -1, createdAt: -1 })
    .select("_id academicPeriodId status")
    .lean();

  const preferredVersionByPeriodId = new Map<string, string>();
  for (const version of versionsRaw as Array<{
    _id: Types.ObjectId;
    academicPeriodId: Types.ObjectId;
    status: "draft" | "published";
  }>) {
    const periodKey = String(version.academicPeriodId);
    if (!preferredVersionByPeriodId.has(periodKey)) {
      preferredVersionByPeriodId.set(periodKey, String(version._id));
    }
  }

  const rows = await Promise.all(
    Array.from(preferredVersionByPeriodId.entries()).map(async ([periodId, versionId]) => {
      const slots = await querySlotsForTeacherWithAssignments({
        schoolId: args.schoolId,
        versionId: new Types.ObjectId(versionId),
        teacherId: args.teacherId,
        academicPeriodId: new Types.ObjectId(periodId),
        dayOfWeekIn: [0, 1, 2, 3, 4, 5, 6],
      });

      return slots.map((slot) => ({
        key: toAssignmentKey(periodId, slot.classGroupId, slot.subjectId),
        schedule: {
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          location: slot.classroomLabel || null,
        },
      }));
    })
  );

  for (const row of rows.flat()) {
    const existing = scheduleMap.get(row.key) || [];
    existing.push(row.schedule);
    scheduleMap.set(row.key, existing);
  }

  for (const [key, schedules] of scheduleMap.entries()) {
    const seen = new Set<string>();
    const deduped = schedules
      .filter((schedule) => {
        const hash = `${schedule.dayOfWeek}|${schedule.startTime}|${schedule.endTime}|${schedule.location || ""}`;
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
      })
      .sort((left, right) => {
        if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek - right.dayOfWeek;
        if (left.startTime !== right.startTime) {
          return left.startTime.localeCompare(right.startTime);
        }
        return left.endTime.localeCompare(right.endTime);
      });
    scheduleMap.set(key, deduped);
  }

  return scheduleMap;
}

export function assignmentScheduleKey(args: {
  academicPeriodId: Types.ObjectId | string;
  classGroupId: Types.ObjectId | string;
  subjectId: Types.ObjectId | string;
}): string {
  return toAssignmentKey(args.academicPeriodId, args.classGroupId, args.subjectId);
}
