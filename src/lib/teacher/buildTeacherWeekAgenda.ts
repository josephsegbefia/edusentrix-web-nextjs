import { Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { SchoolSettings } from "@/models/SchoolSettings";
import { TimetableVersion } from "@/models/TimetableVersion";
import {
  DutyDefinition,
  TeacherDutyAssignment,
} from "@/models/TeacherDutyAssignment";
import {
  enrichSlotsForDisplay,
  formatDateYmd,
  getWeekStartMonday,
  querySlotsForTeacherWithAssignments,
} from "@/lib/timetable/read-model";

type WeekAgendaBoundaryState = "inside" | "partial" | "outside";
type LessonVersionStatus = "draft" | "published" | null;

type PeriodWeekContext = {
  period: {
    _id: Types.ObjectId;
    yearLabel: string;
    term: string;
    startDate: Date;
    endDate: Date;
    isCurrent?: boolean;
  };
  version: {
    _id: Types.ObjectId;
    status: "draft" | "published";
    publishedAt?: Date | null;
  } | null;
};

export type TeacherWeekAgendaLessonDTO = {
  id: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  classGroupId: string;
  classGroupName: string | null;
  gradeName: string | null;
  classLabel: string;
  classroomLabel: string;
  teacherId: string;
  teacherName: string | null;
  teacherIds: string[];
  teacherNames: string[];
  teacherLinkSource: "assignment" | "slot" | "fallback" | "unassigned";
  academicPeriodId: string;
  academicPeriodLabel: string;
  versionId: string | null;
  versionStatus: LessonVersionStatus;
  publishedAt: string | null;
};

export type TeacherWeekAgendaDutyDTO = {
  id: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  dutyDefinitionId: string;
  dutyName: string;
  dutyCode: string;
  dutyCategory: string;
  dutyColor: string | null;
  location: string | null;
  notes: string | null;
  weekNumber: number | null;
  specificDate: string | null;
  startDate: string;
  endDate: string | null;
  academicPeriodId: string;
  academicPeriodLabel: string;
};

export type TeacherWeekAgendaDayDTO = {
  date: string;
  dayOfWeek: number;
  inAcademicPeriod: boolean;
  academicPeriodId: string | null;
  academicPeriodLabel: string | null;
  lessonCount: number;
  dutyCount: number;
  totalCount: number;
};

export type TeacherWeekAgendaDTO = {
  teacherId: string;
  selectedDate: string;
  weekStart: string;
  weekEnd: string;
  workingDays: number[];
  visibleDays: number[];
  boundaryState: WeekAgendaBoundaryState;
  timeAxis: {
    startHour: number;
    endHour: number;
    hours: number[];
  };
  summary: {
    lessonCount: number;
    dutyCount: number;
    totalCount: number;
  };
  academicPeriods: Array<{
    id: string;
    yearLabel: string;
    term: string;
    label: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    lessonVersionId: string | null;
    lessonVersionStatus: LessonVersionStatus;
    lessonPublishedAt: string | null;
  }>;
  days: TeacherWeekAgendaDayDTO[];
  lessons: TeacherWeekAgendaLessonDTO[];
  duties: TeacherWeekAgendaDutyDTO[];
};

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function normalizeWorkingDays(days?: number[] | null): number[] {
  const fallback = [1, 2, 3, 4, 5];
  if (!Array.isArray(days) || days.length === 0) return fallback;
  const filtered = Array.from(
    new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
  ).sort((a, b) => a - b);
  return filtered.length > 0 ? filtered : fallback;
}

function dateForWeekDay(weekStart: Date, dayOfWeek: number): Date {
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + offset
  );
}

function isDateWithin(date: Date, start: Date, end: Date): boolean {
  const target = stripTime(date).getTime();
  return target >= stripTime(start).getTime() && target <= stripTime(end).getTime();
}

function buildPeriodLabel(period: { yearLabel: string; term: string }): string {
  return `${period.yearLabel} ${period.term}`.trim();
}

function deriveVisibleDays(
  workingDays: number[],
  lessons: TeacherWeekAgendaLessonDTO[],
  duties: TeacherWeekAgendaDutyDTO[]
): number[] {
  const values = new Set<number>(workingDays);
  for (const lesson of lessons) values.add(lesson.dayOfWeek);
  for (const duty of duties) values.add(duty.dayOfWeek);
  return Array.from(values)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

function deriveBoundaryState(days: TeacherWeekAgendaDayDTO[]): WeekAgendaBoundaryState {
  const inPeriodCount = days.filter((day) => day.inAcademicPeriod).length;
  if (inPeriodCount === 0) return "outside";
  if (inPeriodCount === days.length) return "inside";
  return "partial";
}

function buildTimeAxis(
  lessons: TeacherWeekAgendaLessonDTO[],
  duties: TeacherWeekAgendaDutyDTO[]
): { startHour: number; endHour: number; hours: number[] } {
  let startHour = 6;
  let endHour = 20;

  const items = [
    ...lessons.map((lesson) => ({
      startTime: lesson.startTime,
      endTime: lesson.endTime,
    })),
    ...duties.map((duty) => ({
      startTime: duty.startTime,
      endTime: duty.endTime,
    })),
  ];

  for (const item of items) {
    const [startHourRaw] = item.startTime.split(":").map(Number);
    const [endHourRaw, endMinuteRaw] = item.endTime.split(":").map(Number);
    if (Number.isFinite(startHourRaw)) {
      startHour = Math.min(startHour, startHourRaw);
    }
    if (Number.isFinite(endHourRaw)) {
      const totalMinutes =
        endHourRaw * 60 + (Number.isFinite(endMinuteRaw) ? endMinuteRaw : 0);
      endHour = Math.max(endHour, Math.min(24, Math.ceil(totalMinutes / 60) + 1));
    }
  }

  if (endHour <= startHour) {
    endHour = Math.min(20, startHour + 8);
  }

  const hours: number[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    hours.push(hour);
  }

  return {
    startHour,
    endHour,
    hours: hours.length > 0 ? hours : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  };
}

async function loadCurrentPeriodContext(args: {
  schoolId: Types.ObjectId;
}): Promise<PeriodWeekContext[]> {
  const period = ((await AcademicPeriod.findOne({
    schoolId: args.schoolId,
    isCurrent: true,
  })
    .select("_id yearLabel term startDate endDate isCurrent")
    .lean()) ||
    (await AcademicPeriod.findOne({ schoolId: args.schoolId })
      .sort({ isCurrent: -1, endDate: -1, startDate: -1 })
      .select("_id yearLabel term startDate endDate isCurrent")
      .lean())) as {
    _id: Types.ObjectId;
    yearLabel: string;
    term: string;
    startDate: Date;
    endDate: Date;
    isCurrent?: boolean;
  } | null;

  if (!period) return [];

  const [draftVersion, publishedVersion] = await Promise.all([
    TimetableVersion.findOne({
      schoolId: args.schoolId,
      academicPeriodId: period._id,
      status: "draft",
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .select("_id status publishedAt")
      .lean(),
    TimetableVersion.findOne({
      schoolId: args.schoolId,
      academicPeriodId: period._id,
      status: "published",
    })
      .sort({ publishedAt: -1, updatedAt: -1, createdAt: -1 })
      .select("_id status publishedAt")
      .lean(),
  ]);

  return [
    {
      period,
      version:
        (draftVersion as {
          _id: Types.ObjectId;
          status: "draft" | "published";
          publishedAt?: Date | null;
        } | null) ||
        (publishedVersion as {
          _id: Types.ObjectId;
          status: "draft" | "published";
          publishedAt?: Date | null;
        } | null) ||
        null,
    },
  ];
}

export async function buildTeacherWeekAgenda(args: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  targetDate: Date;
}): Promise<TeacherWeekAgendaDTO> {
  const weekStart = getWeekStartMonday(args.targetDate);
  const weekEnd = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate() + 6
  );

  const settings = await SchoolSettings.findOne({ schoolId: args.schoolId })
    .select("workingDays")
    .lean();
  const workingDays = normalizeWorkingDays(
    (settings as { workingDays?: number[] } | null)?.workingDays
  );

  const periodContexts = await loadCurrentPeriodContext({
    schoolId: args.schoolId,
  });

  const lessons: TeacherWeekAgendaLessonDTO[] = [];
  const duties: TeacherWeekAgendaDutyDTO[] = [];

  for (const context of periodContexts) {
    const periodLabel = buildPeriodLabel(context.period);
    const periodStart = stripTime(new Date(context.period.startDate));
    const periodEnd = stripTime(new Date(context.period.endDate));

    if (context.version) {
      const slots = await querySlotsForTeacherWithAssignments({
        schoolId: args.schoolId,
        versionId: context.version._id,
        teacherId: args.teacherId,
        academicPeriodId: context.period._id,
        dayOfWeekIn: [0, 1, 2, 3, 4, 5, 6],
      });
      const enrichedSlots = await enrichSlotsForDisplay({
        schoolId: args.schoolId,
        slots,
      });

      for (const slot of enrichedSlots) {
        const slotDate = dateForWeekDay(weekStart, slot.dayOfWeek);
        if (!isDateWithin(slotDate, periodStart, periodEnd)) continue;
        const classLabel = [slot.gradeName, slot.classGroupName]
          .filter((value): value is string => Boolean(value))
          .join(" ")
          .trim();

        lessons.push({
          id: slot.id,
          date: formatDateYmd(slotDate),
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          subjectId: slot.subjectId,
          subjectName: slot.subjectName || "Subject",
          subjectCode: slot.subjectCode ?? null,
          classGroupId: slot.classGroupId,
          classGroupName: slot.classGroupName || null,
          gradeName: slot.gradeName || null,
          classLabel: classLabel || slot.classGroupName || "Class",
          classroomLabel: slot.classroomLabel || "",
          teacherId: slot.teacherId || "",
          teacherName: slot.teacherName || null,
          teacherIds: slot.teacherIds || (slot.teacherId ? [slot.teacherId] : []),
          teacherNames:
            slot.teacherNames || (slot.teacherName ? [slot.teacherName] : []),
          teacherLinkSource: slot.teacherLinkSource || "unassigned",
          academicPeriodId: String(context.period._id),
          academicPeriodLabel: periodLabel,
          versionId: String(context.version._id),
          versionStatus: context.version.status,
          publishedAt: context.version.publishedAt
            ? new Date(context.version.publishedAt).toISOString()
            : null,
        });
      }
    }

    const dutyRows = (await TeacherDutyAssignment.find({
      schoolId: args.schoolId,
      teacherId: args.teacherId,
      academicPeriodId: context.period._id,
      isActive: true,
      startDate: { $lte: endOfDay(weekEnd) },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gte: stripTime(weekStart) } },
      ],
    })
      .select(
        "_id dutyDefinitionId days startTime endTime specificDate weekNumber startDate endDate notes"
      )
      .lean()) as Array<{
      _id: Types.ObjectId;
      dutyDefinitionId: Types.ObjectId;
      days?: number[];
      startTime: string;
      endTime: string;
      specificDate?: Date | null;
      weekNumber?: number | null;
      startDate: Date;
      endDate?: Date | null;
      notes?: string | null;
    }>;

    const dutyDefinitionIds = Array.from(
      new Set(dutyRows.map((row) => String(row.dutyDefinitionId)))
    ).map((id) => new Types.ObjectId(id));

    const definitions = dutyDefinitionIds.length
      ? await DutyDefinition.find({
          schoolId: args.schoolId,
          _id: { $in: dutyDefinitionIds },
        })
          .select("_id name code category color location")
          .lean()
      : [];

    const definitionMap = new Map<
      string,
      {
        name: string;
        code: string;
        category: string;
        color?: string | null;
        location?: string | null;
      }
    >();
    for (const definition of definitions as Array<{
      _id: Types.ObjectId;
      name: string;
      code: string;
      category: string;
      color?: string | null;
      location?: string | null;
    }>) {
      definitionMap.set(String(definition._id), definition);
    }

    for (const row of dutyRows) {
      const definition = definitionMap.get(String(row.dutyDefinitionId));
      if (!definition) continue;

      const assignmentStart = stripTime(new Date(row.startDate));
      const assignmentEnd = row.endDate
        ? stripTime(new Date(row.endDate))
        : periodEnd;

      const maybeAddDuty = (dutyDate: Date) => {
        if (!isDateWithin(dutyDate, periodStart, periodEnd)) return;
        if (!isDateWithin(dutyDate, assignmentStart, assignmentEnd)) return;

        duties.push({
          id: String(row._id),
          date: formatDateYmd(dutyDate),
          dayOfWeek: dutyDate.getDay(),
          startTime: row.startTime,
          endTime: row.endTime,
          dutyDefinitionId: String(row.dutyDefinitionId),
          dutyName: definition.name,
          dutyCode: definition.code,
          dutyCategory: definition.category,
          dutyColor: definition.color ?? null,
          location: definition.location ?? null,
          notes: row.notes || null,
          weekNumber:
            typeof row.weekNumber === "number" ? row.weekNumber : null,
          specificDate: row.specificDate
            ? new Date(row.specificDate).toISOString()
            : null,
          startDate: new Date(row.startDate).toISOString(),
          endDate: row.endDate ? new Date(row.endDate).toISOString() : null,
          academicPeriodId: String(context.period._id),
          academicPeriodLabel: periodLabel,
        });
      };

      if (row.specificDate) {
        const specificDate = stripTime(new Date(row.specificDate));
        if (isDateWithin(specificDate, weekStart, weekEnd)) {
          maybeAddDuty(specificDate);
        }
        continue;
      }

      for (const dayOfWeek of row.days || []) {
        const dutyDate = dateForWeekDay(weekStart, dayOfWeek);
        maybeAddDuty(dutyDate);
      }
    }
  }

  lessons.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }
    return left.subjectName.localeCompare(right.subjectName);
  });

  duties.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }
    return left.dutyName.localeCompare(right.dutyName);
  });

  const visibleDays = deriveVisibleDays(workingDays, lessons, duties);
  const days: TeacherWeekAgendaDayDTO[] = visibleDays.map((dayOfWeek) => {
    const date = dateForWeekDay(weekStart, dayOfWeek);
    const dateYmd = formatDateYmd(date);
    const periodForDay = periodContexts.find((context) =>
      isDateWithin(date, new Date(context.period.startDate), new Date(context.period.endDate))
    );
    const lessonCount = lessons.filter((lesson) => lesson.date === dateYmd).length;
    const dutyCount = duties.filter((duty) => duty.date === dateYmd).length;

    return {
      date: dateYmd,
      dayOfWeek,
      inAcademicPeriod: Boolean(periodForDay),
      academicPeriodId: periodForDay ? String(periodForDay.period._id) : null,
      academicPeriodLabel: periodForDay
        ? buildPeriodLabel(periodForDay.period)
        : null,
      lessonCount,
      dutyCount,
      totalCount: lessonCount + dutyCount,
    };
  });

  return {
    teacherId: String(args.teacherId),
    selectedDate: formatDateYmd(args.targetDate),
    weekStart: formatDateYmd(weekStart),
    weekEnd: formatDateYmd(weekEnd),
    workingDays,
    visibleDays,
    boundaryState: deriveBoundaryState(days),
    timeAxis: buildTimeAxis(lessons, duties),
    summary: {
      lessonCount: lessons.length,
      dutyCount: duties.length,
      totalCount: lessons.length + duties.length,
    },
    academicPeriods: periodContexts.map((context) => ({
      id: String(context.period._id),
      yearLabel: context.period.yearLabel,
      term: context.period.term,
      label: buildPeriodLabel(context.period),
      startDate: new Date(context.period.startDate).toISOString(),
      endDate: new Date(context.period.endDate).toISOString(),
      isCurrent: Boolean(context.period.isCurrent),
      lessonVersionId: context.version ? String(context.version._id) : null,
      lessonVersionStatus: context.version?.status || null,
      lessonPublishedAt: context.version?.publishedAt
        ? new Date(context.version.publishedAt).toISOString()
        : null,
    })),
    days,
    lessons,
    duties,
  };
}
