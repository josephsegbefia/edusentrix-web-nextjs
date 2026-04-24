import { useQuery } from "@tanstack/react-query";

export type TeacherWeekLessonDTO = {
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
  versionStatus: "draft" | "published" | null;
  publishedAt: string | null;
};

export type TeacherWeekDutyDTO = {
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
  boundaryState: "inside" | "partial" | "outside";
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
    lessonVersionStatus: "draft" | "published" | null;
    lessonPublishedAt: string | null;
  }>;
  days: TeacherWeekAgendaDayDTO[];
  lessons: TeacherWeekLessonDTO[];
  duties: TeacherWeekDutyDTO[];
};

type TeacherWeekAgendaResponse = {
  success: boolean;
  data: TeacherWeekAgendaDTO;
  error?: string;
};

function buildTeacherWeekAgendaKey(teacherId: string, date: string) {
  return ["teacher-week-agenda", teacherId, date] as const;
}

export function useTeacherWeekAgenda(teacherId: string, date: string) {
  return useQuery<TeacherWeekAgendaResponse>({
    queryKey: buildTeacherWeekAgendaKey(teacherId, date),
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      const res = await fetch(
        `/api/admin/teachers/${encodeURIComponent(teacherId)}/timetable/week?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as TeacherWeekAgendaResponse | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch teacher weekly schedule");
      }
      if (!json) {
        throw new Error("Failed to fetch teacher weekly schedule");
      }
      return json;
    },
    enabled: Boolean(teacherId && date),
    staleTime: 30_000,
  });
}

export { buildTeacherWeekAgendaKey };
