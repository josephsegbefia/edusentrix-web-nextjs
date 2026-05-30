import mongoose from "mongoose";
import { SubjectResult, type ISubjectResult } from "@/models/SubjectResult";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import {
  COMPLETE_SUBJECT_RESULT_STATUSES,
  subjectResultToPerformanceRow,
  type SubjectResultLike,
} from "@/lib/academics/compatibility/subject-result-adapters";
import type { StudentSubjectPerformanceRow } from "@/types/admin/student-academics";

void Teacher;
void User;

type IdLike = string | mongoose.Types.ObjectId;

function toObjectId(value: IdLike) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(String(value));
}

function buildTeacherName(user: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} | null | undefined) {
  if (!user) return null;
  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return full || user.name || null;
}

export async function loadSubjectResultsGroupedByPeriod(input: {
  schoolId: IdLike;
  studentId: IdLike;
  academicPeriodIds?: string[];
}) {
  const schoolObjectId = toObjectId(input.schoolId);
  const studentObjectId = toObjectId(input.studentId);

  const query: Record<string, unknown> = {
    schoolId: schoolObjectId,
    studentId: studentObjectId,
    status: { $in: [...COMPLETE_SUBJECT_RESULT_STATUSES] },
  };

  if (input.academicPeriodIds?.length) {
    query.academicPeriodId = {
      $in: input.academicPeriodIds.map((id) => toObjectId(id)),
    };
  }

  const results = (await SubjectResult.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean()) as unknown as ISubjectResult[];

  const grouped = new Map<string, ISubjectResult[]>();
  for (const result of results) {
    const periodId = String(result.academicPeriodId);
    const bucket = grouped.get(periodId) ?? [];
    bucket.push(result);
    grouped.set(periodId, bucket);
  }

  return grouped;
}

export async function buildSubjectResultPerformanceRows(input: {
  schoolId: IdLike;
  results: SubjectResultLike[];
}) {
  if (input.results.length === 0) {
    return [];
  }

  const subjectIds = [...new Set(input.results.map((result) => String(result.subjectId)))];
  const teacherIds = [
    ...new Set(input.results.map((result) => String(result.teacherId)).filter(Boolean)),
  ];

  const [subjects, teachers] = await Promise.all([
    Subject.find({
      _id: { $in: subjectIds.map((id) => toObjectId(id)) },
      schoolId: toObjectId(input.schoolId),
    })
      .select("_id name code")
      .lean(),
    teacherIds.length
      ? Teacher.find({ _id: { $in: teacherIds.map((id) => toObjectId(id)) } })
          .select("_id userId")
          .lean()
      : Promise.resolve([]),
  ]);

  const users = teachers.length
    ? await User.find({ _id: { $in: teachers.map((teacher) => teacher.userId).filter(Boolean) } })
        .select("_id firstName lastName name")
        .lean()
    : [];

  const subjectById = new Map(subjects.map((subject) => [String(subject._id), subject]));
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const teacherNameByTeacherId = new Map<string, string | null>();

  for (const teacher of teachers) {
    const user = userById.get(String(teacher.userId));
    teacherNameByTeacherId.set(String(teacher._id), buildTeacherName(user));
  }

  const rowsBySubject = new Map<string, StudentSubjectPerformanceRow>();

  for (const result of input.results) {
    const subjectId = String(result.subjectId);
    if (rowsBySubject.has(subjectId)) continue;

    const subject = subjectById.get(subjectId);
    rowsBySubject.set(
      subjectId,
      subjectResultToPerformanceRow(result, {
        subjectId,
        subjectName: subject?.name ?? "Unknown subject",
        shortCode: subject?.code ?? null,
        teacherName: result.teacherId
          ? teacherNameByTeacherId.get(String(result.teacherId)) ?? null
          : null,
      })
    );
  }

  return Array.from(rowsBySubject.values()).sort((a, b) =>
    a.subjectName.localeCompare(b.subjectName)
  );
}

export async function loadSubjectResultsForStudents(input: {
  schoolId: IdLike;
  studentIds: IdLike[];
  academicPeriodId: IdLike;
}) {
  if (input.studentIds.length === 0) {
    return new Map<string, ISubjectResult[]>();
  }

  const results = (await SubjectResult.find({
    schoolId: toObjectId(input.schoolId),
    studentId: { $in: input.studentIds.map((id) => toObjectId(id)) },
    academicPeriodId: toObjectId(input.academicPeriodId),
    status: { $in: [...COMPLETE_SUBJECT_RESULT_STATUSES] },
  }).lean()) as unknown as ISubjectResult[];

  const grouped = new Map<string, ISubjectResult[]>();
  for (const result of results) {
    const studentId = String(result.studentId);
    const bucket = grouped.get(studentId) ?? [];
    bucket.push(result);
    grouped.set(studentId, bucket);
  }

  return grouped;
}
