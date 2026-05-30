/**
 * Attendance section for Student Academic Profile (Slice 5).
 * Released periods: report snapshot; current/in-progress: live homeroom records.
 * @see STUDENT_ACADEMIC_PROFILE_SPEC.md §7.5, §13
 */

import mongoose from "mongoose";
import {
  aggregateHomeroomAttendance,
  loadHomeroomAttendanceRecords,
  type HomeroomAttendanceAggregate,
} from "@/lib/academics/reporting/build-attendance-snapshot";
import { findBestStudentReportCardForProfile } from "@/lib/academics/profile/buildProfileFromReportCard";
import {
  asSnapshotRecord,
  readSnapshotBoolean,
  readSnapshotNumber,
  toIsoDateString,
} from "@/lib/academics/profile/snapshot-field-utils";
import { ReportAttendanceSnapshot } from "@/models/ReportAttendanceSnapshot";
import type { ReportAttendanceSnapshotDTO } from "@/types/academics/assessment-engine";
import type {
  AcademicProfileAttendanceDTO,
  AcademicProfileAttendanceHistoryPointDTO,
  AcademicProfileVisibilityMode,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";

const EMPTY_ATTENDANCE_NOTE =
  "No homeroom attendance recorded for this period yet.";
const RELEASED_EMPTY_NOTE =
  "Official attendance snapshot is not available for this report period.";

export function profileHasReportSnapshotAttendance(
  profile: StudentAcademicProfileDTO
): boolean {
  if (profile.attendance.source !== "report_snapshot") {
    return false;
  }

  return (
    (profile.attendance.totalSchoolDays != null && profile.attendance.totalSchoolDays > 0) ||
    (profile.attendance.daysPresent != null && profile.attendance.daysPresent > 0) ||
    profile.attendance.attendancePercentage != null
  );
}

export function mapAggregateToProfileAttendance(input: {
  aggregate: HomeroomAttendanceAggregate;
  source: AcademicProfileAttendanceDTO["source"];
  isSnapshot: boolean;
  calculatedAt: string | null;
  note: string | null;
}): AcademicProfileAttendanceDTO {
  const { aggregate } = input;

  if (!aggregate.hasRecords) {
    return {
      source: "none",
      isSnapshot: input.isSnapshot,
      totalSchoolDays: null,
      daysPresent: null,
      daysAbsent: null,
      daysLate: null,
      daysExcused: null,
      attendancePercentage: null,
      calculatedAt: input.calculatedAt,
      note: input.note ?? EMPTY_ATTENDANCE_NOTE,
    };
  }

  return {
    source: input.source,
    isSnapshot: input.isSnapshot,
    totalSchoolDays: aggregate.totalSchoolDays,
    daysPresent: aggregate.daysPresent,
    daysAbsent: aggregate.daysAbsent,
    daysLate: aggregate.daysLate,
    daysExcused: aggregate.daysExcused,
    attendancePercentage: aggregate.attendancePercentage,
    calculatedAt: input.calculatedAt,
    note: input.note,
  };
}

export function mapReportAttendanceSnapshotDtoToProfile(
  snapshot: ReportAttendanceSnapshotDTO
): AcademicProfileAttendanceDTO {
  return {
    source: "report_snapshot",
    isSnapshot: true,
    totalSchoolDays: snapshot.totalSchoolDays,
    daysPresent: snapshot.daysPresent,
    daysAbsent: snapshot.daysAbsent,
    daysLate: snapshot.daysLate,
    daysExcused: snapshot.daysExcused,
    attendancePercentage: snapshot.attendancePercentage,
    calculatedAt: toIsoDateString(snapshot.calculatedAt),
    note: null,
  };
}

export function mapStudentReportCardAttendanceSnapshotToProfile(
  attendanceSnapshot: Record<string, unknown>
): AcademicProfileAttendanceDTO | null {
  const snapshot = asSnapshotRecord(attendanceSnapshot);
  if (!snapshot || !readSnapshotBoolean(snapshot.ready)) {
    return null;
  }

  const totalSchoolDays = readSnapshotNumber(snapshot.totalSchoolDays);
  if (totalSchoolDays == null || totalSchoolDays <= 0) {
    const message = typeof snapshot.message === "string" ? snapshot.message : null;
    if (!message && readSnapshotNumber(snapshot.daysPresent) == null) {
      return null;
    }
  }

  return {
    source: "report_snapshot",
    isSnapshot: true,
    totalSchoolDays: readSnapshotNumber(snapshot.totalSchoolDays),
    daysPresent: readSnapshotNumber(snapshot.daysPresent),
    daysAbsent: readSnapshotNumber(snapshot.daysAbsent),
    daysLate: readSnapshotNumber(snapshot.daysLate),
    daysExcused: readSnapshotNumber(snapshot.daysExcused),
    attendancePercentage: readSnapshotNumber(snapshot.attendancePercentage),
    calculatedAt: toIsoDateString(snapshot.calculatedAt),
    note:
      typeof snapshot.message === "string" && snapshot.message.trim()
        ? snapshot.message
        : null,
  };
}

function appendAttendanceHistory(
  profile: StudentAcademicProfileDTO,
  point: AcademicProfileAttendanceHistoryPointDTO
) {
  const existing = profile.trends.attendanceHistory.filter(
    (row) => row.academicPeriodId !== point.academicPeriodId
  );
  profile.trends.attendanceHistory = [...existing, point];
}

function applyAttendanceHistoryPoint(
  profile: StudentAcademicProfileDTO,
  periodId: string,
  attendance: AcademicProfileAttendanceDTO
) {
  if (attendance.source === "none" || attendance.attendancePercentage == null) {
    return;
  }

  appendAttendanceHistory(profile, {
    academicPeriodId: periodId,
    periodLabel: profile.selectedPeriod.label ?? periodId,
    attendancePercentage: attendance.attendancePercentage,
    source: attendance.source,
  });
}

async function loadPersistedReportAttendanceSnapshot(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: string;
}) {
  const doc = await ReportAttendanceSnapshot.findOne({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: new mongoose.Types.ObjectId(input.academicPeriodId),
  })
    .sort({ calculatedAt: -1 })
    .lean();

  if (!doc) return null;

  return {
    _id: String(doc._id),
    schoolId: String(doc.schoolId),
    academicPeriodId: String(doc.academicPeriodId),
    reportCardRunId: String(doc.reportCardRunId),
    studentId: String(doc.studentId),
    classGroupId: String(doc.classGroupId),
    source: doc.source,
    totalSchoolDays: doc.totalSchoolDays,
    daysPresent: doc.daysPresent,
    daysAbsent: doc.daysAbsent,
    daysLate: doc.daysLate,
    daysExcused: doc.daysExcused,
    attendancePercentage: doc.attendancePercentage,
    calculatedFromDate: doc.calculatedFromDate,
    calculatedToDate: doc.calculatedToDate,
    calculatedAt: doc.calculatedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  } satisfies ReportAttendanceSnapshotDTO;
}

async function tryApplyReleasedAttendanceSnapshot(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string;
    visibilityMode: AcademicProfileVisibilityMode;
  }
): Promise<boolean> {
  const persisted = await loadPersistedReportAttendanceSnapshot(input);
  if (persisted) {
    profile.attendance = mapReportAttendanceSnapshotDtoToProfile(persisted);
    applyAttendanceHistoryPoint(profile, input.academicPeriodId, profile.attendance);
    return true;
  }

  const card = await findBestStudentReportCardForProfile({
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
    visibilityMode: input.visibilityMode,
  });

  if (!card) {
    return false;
  }

  const fromCard = mapStudentReportCardAttendanceSnapshotToProfile(
    (card.attendanceSnapshot ?? {}) as Record<string, unknown>
  );

  if (!fromCard) {
    return false;
  }

  profile.attendance = fromCard;
  applyAttendanceHistoryPoint(profile, input.academicPeriodId, profile.attendance);
  return true;
}

async function tryApplyLiveHomeroomAttendance(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string;
    classGroupId: string | null;
  }
): Promise<boolean> {
  if (!input.classGroupId) {
    profile.attendance = mapAggregateToProfileAttendance({
      aggregate: aggregateHomeroomAttendance([]),
      source: "none",
      isSnapshot: false,
      calculatedAt: null,
      note: EMPTY_ATTENDANCE_NOTE,
    });
    return false;
  }

  const records = await loadHomeroomAttendanceRecords({
    schoolId: input.schoolId,
    classGroupId: new mongoose.Types.ObjectId(input.classGroupId),
    academicPeriodId: new mongoose.Types.ObjectId(input.academicPeriodId),
    studentId: input.studentId,
  });

  const aggregate = aggregateHomeroomAttendance(
    records.map((record) => ({
      date: record.date,
      status: record.status,
    }))
  );

  profile.attendance = mapAggregateToProfileAttendance({
    aggregate,
    source: aggregate.hasRecords ? "live_homeroom_attendance" : "none",
    isSnapshot: false,
    calculatedAt: aggregate.hasRecords ? new Date().toISOString() : null,
    note: aggregate.hasRecords ? null : EMPTY_ATTENDANCE_NOTE,
  });

  if (aggregate.hasRecords) {
    applyAttendanceHistoryPoint(profile, input.academicPeriodId, profile.attendance);
    return true;
  }

  return false;
}

/**
 * Fills `profile.attendance` when not already set from a report card view (Slice 3).
 */
export async function applyProfileAttendance(
  profile: StudentAcademicProfileDTO,
  input: {
    schoolId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    academicPeriodId: string | null;
    classGroupId: string | null;
    visibilityMode: AcademicProfileVisibilityMode;
    isReleasedPeriod: boolean;
  }
): Promise<boolean> {
  if (!input.academicPeriodId) {
    return false;
  }

  if (profileHasReportSnapshotAttendance(profile)) {
    applyAttendanceHistoryPoint(profile, input.academicPeriodId, profile.attendance);
    return true;
  }

  if (input.isReleasedPeriod) {
    const applied = await tryApplyReleasedAttendanceSnapshot(profile, {
      schoolId: input.schoolId,
      studentId: input.studentId,
      academicPeriodId: input.academicPeriodId,
      visibilityMode: input.visibilityMode,
    });

    if (applied) {
      return true;
    }

    profile.attendance = mapAggregateToProfileAttendance({
      aggregate: aggregateHomeroomAttendance([]),
      source: "none",
      isSnapshot: true,
      calculatedAt: null,
      note: RELEASED_EMPTY_NOTE,
    });
    return false;
  }

  return tryApplyLiveHomeroomAttendance(profile, {
    schoolId: input.schoolId,
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
    classGroupId: input.classGroupId,
  });
}
