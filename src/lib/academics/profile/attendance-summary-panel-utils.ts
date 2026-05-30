import type {
  AcademicProfileAttendanceDTO,
  AcademicProfileAttendanceSource,
} from "@/types/academics/student-academic-profile";

export type AttendanceSummaryStat = {
  key: string;
  label: string;
  value: string;
};

export type AttendanceSummaryPanelModel = {
  sourceLabel: string;
  source: AcademicProfileAttendanceSource;
  hasData: boolean;
  emptyMessage: string;
  stats: AttendanceSummaryStat[];
  calculatedAtLabel: string | null;
  showCompileWarning: boolean;
  compileWarningMessage: string;
};

const SOURCE_LABELS: Record<AcademicProfileAttendanceSource, string> = {
  live_homeroom_attendance: "Live homeroom attendance",
  report_snapshot: "Official report-card snapshot",
  none: "No attendance data",
};

function formatCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "—";
}

function formatRate(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(1)}%`
    : "—";
}

function formatCalculatedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `Updated ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

export function attendanceSummaryHasData(attendance: AcademicProfileAttendanceDTO) {
  if (attendance.source === "none") {
    return false;
  }

  return (
    (attendance.totalSchoolDays != null && attendance.totalSchoolDays > 0) ||
    (attendance.daysPresent != null && attendance.daysPresent > 0) ||
    attendance.attendancePercentage != null
  );
}

export function buildAttendanceSummaryPanelModel(input: {
  attendance: AcademicProfileAttendanceDTO;
  canViewReadiness?: boolean;
  attendanceReady?: boolean | null;
  isReleasedPeriod?: boolean;
}): AttendanceSummaryPanelModel {
  const { attendance } = input;
  const hasData = attendanceSummaryHasData(attendance);

  const emptyMessage =
    attendance.note ??
    (attendance.source === "report_snapshot"
      ? "Official attendance snapshot is not available for this report period."
      : "No homeroom attendance has been recorded for this period yet.");

  const stats: AttendanceSummaryStat[] = hasData
    ? [
        { key: "schoolDays", label: "School days", value: formatCount(attendance.totalSchoolDays) },
        { key: "present", label: "Present", value: formatCount(attendance.daysPresent) },
        { key: "absent", label: "Absent", value: formatCount(attendance.daysAbsent) },
        { key: "late", label: "Late", value: formatCount(attendance.daysLate) },
        { key: "excused", label: "Excused", value: formatCount(attendance.daysExcused) },
        {
          key: "rate",
          label: "Attendance rate",
          value: formatRate(attendance.attendancePercentage),
        },
      ]
    : [];

  const showCompileWarning =
    !!input.canViewReadiness &&
    !input.isReleasedPeriod &&
    input.attendanceReady === false;

  return {
    sourceLabel: SOURCE_LABELS[attendance.source],
    source: attendance.source,
    hasData,
    emptyMessage,
    stats,
    calculatedAtLabel: formatCalculatedAt(attendance.calculatedAt),
    showCompileWarning,
    compileWarningMessage:
      "Attendance is not ready for report compilation. Homeroom teachers should complete attendance before the report run is compiled.",
  };
}
