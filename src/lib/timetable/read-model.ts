import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SchoolSettings } from "@/models/SchoolSettings";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { User } from "@/models/User";

export type TimetableScope = "school" | "class" | "teacher" | "student";

export interface TimetableReadFilters {
  scope: TimetableScope;
  classGroupId?: Types.ObjectId | null;
  teacherId?: Types.ObjectId | null;
  studentId?: Types.ObjectId | null;
}

export interface TimetableResolvedContext {
  academicPeriodId: Types.ObjectId;
  versionId: Types.ObjectId;
  publishedAt: Date | null;
  workingDays: number[];
}

export interface TimetableSlotDTO {
  id: string;
  classGroupId: string;
  gradeId: string;
  subjectId: string;
  /** Empty when no teacher assigned yet. */
  teacherId: string;
  classGroupName?: string | null;
  gradeName?: string | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  teacherName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
}

export interface TimetableScopedQuery {
  schoolId: Types.ObjectId;
  versionId: Types.ObjectId;
  scope: TimetableScope;
  classGroupId?: Types.ObjectId | null;
  teacherId?: Types.ObjectId | null;
  studentId?: Types.ObjectId | null;
  dayOfWeek?: number | null;
  dayOfWeekIn?: number[];
}

export interface WeeklyTimetableResult {
  noPublishedVersion: boolean;
  publishedVersionId: string | null;
  publishedAt: string | null;
  data: {
    scope: TimetableScope;
    weekStart: string;
    weekEnd: string;
    workingDays: number[];
    days: Array<{
      date: string;
      dayOfWeek: number;
      slots: TimetableSlotDTO[];
    }>;
  };
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function normalizeWorkingDays(days?: number[] | null): number[] {
  const fallback = [1, 2, 3, 4, 5];
  if (!Array.isArray(days) || days.length === 0) return fallback;
  const filtered = Array.from(
    new Set(
      days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    )
  ).sort((a, b) => a - b);
  return filtered.length > 0 ? filtered : fallback;
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (!isValidDate(date)) return null;
  return stripTime(date);
}

export function parseMonthInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}-01T00:00:00`);
  if (!isValidDate(date)) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function formatDateYmd(date: Date): string {
  const yyyy = date.getFullYear().toString();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getWeekStartMonday(date: Date): Date {
  const normalized = stripTime(date);
  const day = normalized.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(
    normalized.getFullYear(),
    normalized.getMonth(),
    normalized.getDate() + diff
  );
}

export function mapSlotDto(slot: {
  _id: Types.ObjectId;
  classGroupId: Types.ObjectId;
  gradeId: Types.ObjectId;
  subjectId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomLabel: string;
  source: string;
}): TimetableSlotDTO {
  return {
    id: String(slot._id),
    classGroupId: String(slot.classGroupId),
    gradeId: String(slot.gradeId),
    subjectId: String(slot.subjectId),
    teacherId: slot.teacherId ? String(slot.teacherId) : "",
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    classroomLabel: slot.classroomLabel,
    source: slot.source,
  };
}

export async function resolvePublishedTimetableContext(
  schoolId: Types.ObjectId,
  referenceDate: Date
): Promise<TimetableResolvedContext | null> {
  const normalizedDate = stripTime(referenceDate);

  const period =
    (await AcademicPeriod.findOne({
      schoolId,
      startDate: { $lte: normalizedDate },
      endDate: { $gte: normalizedDate },
    })
      .sort({ startDate: -1 })
      .select("_id")
      .lean()) ||
    (await AcademicPeriod.findOne({ schoolId, isCurrent: true })
      .select("_id")
      .lean());

  if (!period) return null;

  const academicPeriodId = (period as { _id: Types.ObjectId })._id;
  const version = await TimetableVersion.findOne({
    schoolId,
    academicPeriodId,
    status: "published",
  })
    .select("_id publishedAt")
    .lean();

  if (!version) return null;

  const settings = await SchoolSettings.findOne({ schoolId })
    .select("workingDays")
    .lean();
  const workingDays = normalizeWorkingDays(
    (settings as { workingDays?: number[] } | null)?.workingDays
  );

  return {
    academicPeriodId,
    versionId: (version as { _id: Types.ObjectId })._id,
    publishedAt:
      (version as { publishedAt?: Date | null }).publishedAt || null,
    workingDays,
  };
}

/**
 * Published timetable for a specific academic period (e.g. admin master view by period).
 */
export async function resolvePublishedTimetableContextForPeriod(
  schoolId: Types.ObjectId,
  academicPeriodId: Types.ObjectId
): Promise<TimetableResolvedContext | null> {
  const period = await AcademicPeriod.findOne({
    _id: academicPeriodId,
    schoolId,
  })
    .select("_id")
    .lean();

  if (!period) return null;

  const version = await TimetableVersion.findOne({
    schoolId,
    academicPeriodId,
    status: "published",
  })
    .select("_id publishedAt")
    .lean();

  if (!version) return null;

  const settings = await SchoolSettings.findOne({ schoolId })
    .select("workingDays")
    .lean();
  const workingDays = normalizeWorkingDays(
    (settings as { workingDays?: number[] } | null)?.workingDays
  );

  return {
    academicPeriodId,
    versionId: (version as { _id: Types.ObjectId })._id,
    publishedAt:
      (version as { publishedAt?: Date | null }).publishedAt || null,
    workingDays,
  };
}

export async function resolveScopeFilter(
  args: TimetableReadFilters & { schoolId: Types.ObjectId }
): Promise<
  | { ok: true; classGroupId?: Types.ObjectId; teacherId?: Types.ObjectId }
  | { ok: false; error: string; status: number }
> {
  if (args.scope === "school") return { ok: true };

  if (args.scope === "class") {
    if (!args.classGroupId) {
      return { ok: false, error: "classGroupId is required for scope=class.", status: 400 };
    }
    return { ok: true, classGroupId: args.classGroupId };
  }

  if (args.scope === "teacher") {
    if (!args.teacherId) {
      return { ok: false, error: "teacherId is required for scope=teacher.", status: 400 };
    }
    return { ok: true, teacherId: args.teacherId };
  }

  if (!args.studentId) {
    return { ok: false, error: "studentId is required for scope=student.", status: 400 };
  }

  const student = await Student.findOne({
    _id: args.studentId,
    schoolId: args.schoolId,
  })
    .select("classGroupId")
    .lean();
  if (!student) {
    return { ok: false, error: "studentId not found.", status: 404 };
  }

  return {
    ok: true,
    classGroupId: (student as { classGroupId: Types.ObjectId }).classGroupId,
  };
}

export async function queryPublishedSlots(
  args: TimetableScopedQuery
): Promise<TimetableSlotDTO[]> {
  const filter: Record<string, unknown> = {
    schoolId: args.schoolId,
    versionId: args.versionId,
  };

  if (args.scope === "class" || args.scope === "student") {
    filter.classGroupId = args.classGroupId;
  } else if (args.scope === "teacher") {
    filter.teacherId = args.teacherId;
  }

  if (args.dayOfWeek !== undefined && args.dayOfWeek !== null) {
    filter.dayOfWeek = args.dayOfWeek;
  }
  if (args.dayOfWeekIn && args.dayOfWeekIn.length > 0) {
    filter.dayOfWeek = { $in: args.dayOfWeekIn };
  }

  const slots = await TimetableSlot.find(filter)
    .sort({ dayOfWeek: 1, startTime: 1, _id: 1 })
    .lean();

  return slots.map((slot) =>
    mapSlotDto(
      slot as {
        _id: Types.ObjectId;
        classGroupId: Types.ObjectId;
        gradeId: Types.ObjectId;
        subjectId: Types.ObjectId;
        teacherId: Types.ObjectId;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        classroomLabel: string;
        source: string;
      }
    )
  );
}

function toObjectIds(values: string[]): Types.ObjectId[] {
  const ids: Types.ObjectId[] = [];
  for (const value of values) {
    try {
      ids.push(new Types.ObjectId(value));
    } catch {
      // ignore invalid ids
    }
  }
  return ids;
}

export async function enrichSlotsForDisplay(args: {
  schoolId: Types.ObjectId;
  slots: TimetableSlotDTO[];
}): Promise<TimetableSlotDTO[]> {
  const { schoolId, slots } = args;
  if (!slots.length) return slots;

  // Ensure models needed for populate are registered.
  void User;

  const classIds = toObjectIds(Array.from(new Set(slots.map((slot) => slot.classGroupId))));
  const gradeIds = toObjectIds(Array.from(new Set(slots.map((slot) => slot.gradeId))));
  const subjectIds = toObjectIds(Array.from(new Set(slots.map((slot) => slot.subjectId))));
  const teacherIds = toObjectIds(
    Array.from(
      new Set(slots.map((slot) => slot.teacherId).filter((id) => id && id.length === 24))
    )
  );

  const [classes, grades, subjects, teachers] = await Promise.all([
    classIds.length
      ? ClassGroup.find({ schoolId, _id: { $in: classIds } })
          .select("_id name gradeId")
          .lean()
      : Promise.resolve([]),
    gradeIds.length
      ? Grade.find({ schoolId, _id: { $in: gradeIds } }).select("_id name").lean()
      : Promise.resolve([]),
    subjectIds.length
      ? Subject.find({ schoolId, _id: { $in: subjectIds } })
          .select("_id name code")
          .lean()
      : Promise.resolve([]),
    teacherIds.length
      ? Teacher.find({ schoolId, _id: { $in: teacherIds } })
          .select("_id userId")
          .populate({ path: "userId", select: "firstName lastName", model: User })
          .lean()
      : Promise.resolve([]),
  ]);

  const classMap = new Map<string, { name?: string; gradeId?: Types.ObjectId }>();
  for (const row of classes) {
    const normalized = row as { _id: Types.ObjectId; name?: string; gradeId?: Types.ObjectId };
    classMap.set(String(normalized._id), {
      name: normalized.name,
      gradeId: normalized.gradeId,
    });
  }

  const gradeMap = new Map<string, { name?: string }>();
  for (const row of grades) {
    const normalized = row as { _id: Types.ObjectId; name?: string };
    gradeMap.set(String(normalized._id), { name: normalized.name });
  }

  const subjectMap = new Map<string, { name?: string; code?: string | null }>();
  for (const row of subjects) {
    const normalized = row as { _id: Types.ObjectId; name?: string; code?: string | null };
    subjectMap.set(String(normalized._id), {
      name: normalized.name,
      code: normalized.code ?? null,
    });
  }

  const teacherMap = new Map<string, { name: string | null }>();
  for (const row of teachers) {
    const normalized = row as {
      _id: Types.ObjectId;
      userId?: { firstName?: string; lastName?: string } | null;
    };
    const firstName = normalized.userId?.firstName || "";
    const lastName = normalized.userId?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    teacherMap.set(String(normalized._id), { name: fullName || null });
  }

  return slots.map((slot) => {
    const classInfo = classMap.get(slot.classGroupId);
    const gradeInfo =
      gradeMap.get(slot.gradeId) ||
      (classInfo?.gradeId ? gradeMap.get(String(classInfo.gradeId)) : undefined);
    const subjectInfo = subjectMap.get(slot.subjectId);
    const teacherInfo = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;

    return {
      ...slot,
      classGroupName: classInfo?.name || null,
      gradeName: gradeInfo?.name || null,
      subjectName: subjectInfo?.name || null,
      subjectCode: subjectInfo?.code ?? null,
      teacherName: teacherInfo?.name ?? null,
    };
  });
}

export async function getPublishedWeekTimetable(args: {
  schoolId: Types.ObjectId;
  targetDate: Date;
  scope: TimetableScope;
  classGroupId?: Types.ObjectId | null;
  teacherId?: Types.ObjectId | null;
  studentId?: Types.ObjectId | null;
}): Promise<
  | WeeklyTimetableResult
  | {
      error: string;
      status: number;
    }
> {
  const published = await resolvePublishedTimetableContext(
    args.schoolId,
    args.targetDate
  );
  const weekStart = getWeekStartMonday(args.targetDate);
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6
  );

  if (!published) {
    return {
      noPublishedVersion: true,
      publishedVersionId: null,
      publishedAt: null,
      data: {
        scope: args.scope,
        weekStart: formatDateYmd(weekStart),
        weekEnd: formatDateYmd(weekEnd),
        workingDays: [1, 2, 3, 4, 5],
        days: [],
      },
    };
  }

  const scopeFilter = await resolveScopeFilter({
    schoolId: args.schoolId,
    scope: args.scope,
    classGroupId: args.classGroupId,
    teacherId: args.teacherId,
    studentId: args.studentId,
  });

  if (!scopeFilter.ok) {
    return {
      error: scopeFilter.error,
      status: scopeFilter.status,
    };
  }

  const slots = await queryPublishedSlots({
    schoolId: args.schoolId,
    versionId: published.versionId,
    scope: args.scope,
    classGroupId: scopeFilter.classGroupId,
    teacherId: scopeFilter.teacherId,
    dayOfWeekIn: published.workingDays,
  });
  const enrichedSlots = await enrichSlotsForDisplay({
    schoolId: args.schoolId,
    slots,
  });

  const byDay = new Map<number, TimetableSlotDTO[]>();
  for (const day of published.workingDays) byDay.set(day, []);
  for (const slot of enrichedSlots) {
    const existing = byDay.get(slot.dayOfWeek) || [];
    existing.push(slot);
    byDay.set(slot.dayOfWeek, existing);
  }

  const days = published.workingDays.map((dayOfWeek) => {
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const date = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate() + offset
    );
    return {
      date: formatDateYmd(date),
      dayOfWeek,
      slots: (byDay.get(dayOfWeek) || []).sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    };
  });

  return {
    noPublishedVersion: false,
    publishedVersionId: String(published.versionId),
    publishedAt: published.publishedAt ? published.publishedAt.toISOString() : null,
    data: {
      scope: args.scope,
      weekStart: formatDateYmd(weekStart),
      weekEnd: formatDateYmd(weekEnd),
      workingDays: published.workingDays,
      days,
    },
  };
}
