import mongoose from "mongoose";
import { StudentAttendance } from "@/models/StudentAttendance";
import { ReportAttendanceSnapshot } from "@/models/ReportAttendanceSnapshot";
import type { ReportAttendanceSnapshotDTO } from "@/types/academics/assessment-engine";

export type HomeroomAttendanceStatus = "present" | "absent" | "late" | "excused";

export type HomeroomAttendanceRecord = {
  date: Date;
  status: HomeroomAttendanceStatus;
};

export type HomeroomAttendanceAggregate = {
  totalSchoolDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  attendancePercentage: number;
  calculatedFromDate: Date | null;
  calculatedToDate: Date | null;
  hasRecords: boolean;
};

export type BuildReportAttendanceSnapshotInput = {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  reportCardRunId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
};

/**
 * MVP attendance rate: present / unique school days.
 * Late and excused are tracked separately and do not count as present.
 */
export function aggregateHomeroomAttendance(
  records: HomeroomAttendanceRecord[]
): HomeroomAttendanceAggregate {
  if (records.length === 0) {
    return {
      totalSchoolDays: 0,
      daysPresent: 0,
      daysAbsent: 0,
      daysLate: 0,
      daysExcused: 0,
      attendancePercentage: 0,
      calculatedFromDate: null,
      calculatedToDate: null,
      hasRecords: false,
    };
  }

  const byDate = new Map<string, HomeroomAttendanceRecord>();
  for (const record of records) {
    const key = record.date.toISOString().slice(0, 10);
    byDate.set(key, record);
  }

  const uniqueRecords = [...byDate.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  let daysPresent = 0;
  let daysAbsent = 0;
  let daysLate = 0;
  let daysExcused = 0;

  for (const record of uniqueRecords) {
    if (record.status === "present") daysPresent += 1;
    if (record.status === "absent") daysAbsent += 1;
    if (record.status === "late") daysLate += 1;
    if (record.status === "excused") daysExcused += 1;
  }

  const totalSchoolDays = uniqueRecords.length;
  const attendancePercentage =
    totalSchoolDays > 0 ? Math.round((daysPresent / totalSchoolDays) * 1000) / 10 : 0;

  return {
    totalSchoolDays,
    daysPresent,
    daysAbsent,
    daysLate,
    daysExcused,
    attendancePercentage,
    calculatedFromDate: uniqueRecords[0]?.date ?? null,
    calculatedToDate: uniqueRecords[uniqueRecords.length - 1]?.date ?? null,
    hasRecords: true,
  };
}

export async function loadHomeroomAttendanceRecords(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
}) {
  const query: Record<string, unknown> = {
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
    type: "homeroom",
  };

  if (input.studentId) {
    query.studentId = input.studentId;
  }

  const records = await StudentAttendance.find(query)
    .select("studentId date status")
    .sort({ date: 1 })
    .lean();

  return records.map((record) => ({
    studentId: String(record.studentId),
    date: record.date as Date,
    status: record.status as HomeroomAttendanceStatus,
  }));
}

export async function hasHomeroomAttendanceRecords(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
}) {
  const record = await StudentAttendance.findOne({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
    type: "homeroom",
  })
    .select("_id")
    .lean();

  return Boolean(record);
}

export function serializeReportAttendanceSnapshot(
  doc: Record<string, unknown>
): ReportAttendanceSnapshotDTO {
  const row = doc as {
    _id: mongoose.Types.ObjectId;
    schoolId: mongoose.Types.ObjectId;
    academicPeriodId: mongoose.Types.ObjectId;
    reportCardRunId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    classGroupId: mongoose.Types.ObjectId;
    source: ReportAttendanceSnapshotDTO["source"];
    totalSchoolDays: number;
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    daysExcused: number;
    attendancePercentage: number;
    calculatedFromDate: Date;
    calculatedToDate: Date;
    calculatedAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    academicPeriodId: String(row.academicPeriodId),
    reportCardRunId: String(row.reportCardRunId),
    studentId: String(row.studentId),
    classGroupId: String(row.classGroupId),
    source: row.source,
    totalSchoolDays: row.totalSchoolDays,
    daysPresent: row.daysPresent,
    daysAbsent: row.daysAbsent,
    daysLate: row.daysLate,
    daysExcused: row.daysExcused,
    attendancePercentage: row.attendancePercentage,
    calculatedFromDate: row.calculatedFromDate,
    calculatedToDate: row.calculatedToDate,
    calculatedAt: row.calculatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toStudentReportCardAttendanceSnapshot(
  snapshot: ReportAttendanceSnapshotDTO | null
): Record<string, unknown> {
  if (!snapshot) {
    return {
      ready: false,
      source: "homeroom_daily_attendance",
      message: "Attendance snapshot unavailable for this student.",
    };
  }

  return {
    ready: true,
    source: snapshot.source,
    snapshotId: snapshot._id,
    totalSchoolDays: snapshot.totalSchoolDays,
    daysPresent: snapshot.daysPresent,
    daysAbsent: snapshot.daysAbsent,
    daysLate: snapshot.daysLate,
    daysExcused: snapshot.daysExcused,
    attendancePercentage: snapshot.attendancePercentage,
    calculatedFromDate: snapshot.calculatedFromDate,
    calculatedToDate: snapshot.calculatedToDate,
    calculatedAt: snapshot.calculatedAt,
  };
}

export async function upsertReportAttendanceSnapshot(input: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  reportCardRunId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  records: HomeroomAttendanceRecord[];
}) {
  const aggregate = aggregateHomeroomAttendance(input.records);
  const calculatedAt = new Date();

  if (!aggregate.hasRecords || !aggregate.calculatedFromDate || !aggregate.calculatedToDate) {
    return null;
  }

  const doc = await ReportAttendanceSnapshot.findOneAndUpdate(
    {
      reportCardRunId: input.reportCardRunId,
      studentId: input.studentId,
    },
    {
      $set: {
        schoolId: input.schoolId,
        academicPeriodId: input.academicPeriodId,
        classGroupId: input.classGroupId,
        source: "homeroom_daily_attendance",
        totalSchoolDays: aggregate.totalSchoolDays,
        daysPresent: aggregate.daysPresent,
        daysAbsent: aggregate.daysAbsent,
        daysLate: aggregate.daysLate,
        daysExcused: aggregate.daysExcused,
        attendancePercentage: aggregate.attendancePercentage,
        calculatedFromDate: aggregate.calculatedFromDate,
        calculatedToDate: aggregate.calculatedToDate,
        calculatedAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return serializeReportAttendanceSnapshot(doc as Record<string, unknown>);
}

/**
 * Loads homeroom attendance for one student, persists ReportAttendanceSnapshot,
 * and returns the DTO used to embed attendance on StudentReportCard.
 */
export async function buildReportAttendanceSnapshotForStudent(
  input: BuildReportAttendanceSnapshotInput
): Promise<ReportAttendanceSnapshotDTO | null> {
  const records = await loadHomeroomAttendanceRecords({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
    studentId: input.studentId,
  });

  return upsertReportAttendanceSnapshot({
    ...input,
    records: records.map((record) => ({
      date: record.date,
      status: record.status,
    })),
  });
}

export async function buildStudentReportCardAttendanceSnapshot(
  input: BuildReportAttendanceSnapshotInput
) {
  const snapshot = await buildReportAttendanceSnapshotForStudent(input);
  return toStudentReportCardAttendanceSnapshot(snapshot);
}
