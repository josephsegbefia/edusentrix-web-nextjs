import mongoose from "mongoose";
import { z } from "zod";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { ReportCardRun, type IReportCardRun } from "@/models/ReportCardRun";
import { ReportTemplate } from "@/models/ReportTemplate";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { StudentReportCard } from "@/models/StudentReportCard";
import { Subject } from "@/models/Subject";
import { SubjectResult } from "@/models/SubjectResult";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { serializeAssessmentPlan } from "@/lib/academics/assessment-engine/assessment-plan-service";
import { serializeGradingPolicy } from "@/lib/academics/assessment-engine/grading-policy-service";
import {
  buildStudentReportCardAttendanceSnapshot,
  hasHomeroomAttendanceRecords,
} from "@/lib/academics/reporting/build-attendance-snapshot";
import type {
  ReportCardRunDetailDTO,
  ReportCardRunDTO,
  ReportCardRunIssueSummary,
  ReportCardRunListItemDTO,
  ReportCardRunReadinessSnapshot,
  ReportCardRunStatus,
  ReportCardRunSubjectReadinessRow,
  SubjectResultStatus,
  TeacherGradebookAcademicPeriodRef,
  TeacherGradebookClassGroupRef,
} from "@/types/academics/assessment-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

export const openReportCardRunBodySchema = z.object({
  classGroupId: objectIdSchema,
  academicPeriodId: objectIdSchema.optional(),
});

export type OpenReportCardRunBody = z.infer<typeof openReportCardRunBodySchema>;

export type HomeroomReportRunContext = {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  homeroomClassGroupId?: mongoose.Types.ObjectId | null;
  isAdmin: boolean;
};

const SUBJECT_RESULT_COMPLETE_STATUSES = new Set<SubjectResultStatus>([
  "submitted",
  "approved",
  "locked",
]);

const COMPILED_RUN_STATUSES = new Set<ReportCardRunStatus>([
  "compiled",
  "submitted_for_approval",
  "approved",
  "released",
]);

const COMPILE_ALLOWED_STATUSES = new Set<ReportCardRunStatus>([
  "draft",
  "opened",
  "collecting_marks",
  "ready_to_compile",
  "returned",
]);

function toObjectIdOrNull(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function formatPersonName(input: {
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
}) {
  return [input.lastName, input.firstName, input.middleName].filter(Boolean).join(" ").trim();
}

export function parseOpenReportCardRunBody(
  body: unknown
): { ok: true; data: OpenReportCardRunBody } | { ok: false; error: string } {
  const parsed = openReportCardRunBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid report run payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function serializeReportCardRun(doc: IReportCardRun | Record<string, unknown>): ReportCardRunDTO {
  const row = doc as IReportCardRun;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    academicPeriodId: String(row.academicPeriodId),
    classGroupId: String(row.classGroupId),
    gradeId: String(row.gradeId),
    homeroomTeacherId: String(row.homeroomTeacherId),
    gradingPolicyId: String(row.gradingPolicyId),
    assessmentPlanId: String(row.assessmentPlanId),
    reportTemplateId: row.reportTemplateId ? String(row.reportTemplateId) : null,
    status: row.status,
    openedBy: row.openedBy ? String(row.openedBy) : null,
    openedAt: row.openedAt ?? null,
    compiledBy: row.compiledBy ? String(row.compiledBy) : null,
    compiledAt: row.compiledAt ?? null,
    submittedBy: row.submittedBy ? String(row.submittedBy) : null,
    submittedAt: row.submittedAt ?? null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt ?? null,
    releasedBy: row.releasedBy ? String(row.releasedBy) : null,
    releasedAt: row.releasedAt ?? null,
    releaseVisibility: row.releaseVisibility ?? null,
    readinessSnapshot: row.readinessSnapshot ?? null,
    issueSummary: row.issueSummary ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function assertHomeroomReportRunAccess(
  context: HomeroomReportRunContext,
  classGroupId: mongoose.Types.ObjectId
): Promise<
  | {
      ok: true;
      classGroup: {
        _id: mongoose.Types.ObjectId;
        name: string;
        gradeId: mongoose.Types.ObjectId;
        homeroomTeacherId?: mongoose.Types.ObjectId | null;
      };
    }
  | { ok: false; error: string; status: 403 | 404 }
> {
  const classGroup = await ClassGroup.findOne({
    _id: classGroupId,
    schoolId: context.schoolId,
  })
    .select("_id name gradeId homeroomTeacherId")
    .lean();

  if (!classGroup || !classGroup.gradeId) {
    return { ok: false, error: "Class group not found", status: 404 };
  }

  if (context.isAdmin) {
    return { ok: true, classGroup: classGroup as typeof classGroup & { gradeId: mongoose.Types.ObjectId } };
  }

  const isAssignedHomeroom =
    (classGroup.homeroomTeacherId &&
      String(classGroup.homeroomTeacherId) === String(context.teacherId)) ||
    (context.homeroomClassGroupId &&
      String(context.homeroomClassGroupId) === String(classGroupId));

  if (!isAssignedHomeroom) {
    return {
      ok: false,
      error: "Only the assigned homeroom teacher can manage this report run.",
      status: 403,
    };
  }

  return { ok: true, classGroup: classGroup as typeof classGroup & { gradeId: mongoose.Types.ObjectId } };
}

async function resolveReportRunScope(input: {
  context: HomeroomReportRunContext;
  classGroupId: mongoose.Types.ObjectId;
  academicPeriodId?: mongoose.Types.ObjectId | null;
}) {
  const access = await assertHomeroomReportRunAccess(input.context, input.classGroupId);
  if (!access.ok) {
    return access;
  }

  const periodQuery: Record<string, unknown> = { schoolId: input.context.schoolId };
  if (input.academicPeriodId) {
    periodQuery._id = input.academicPeriodId;
  } else {
    periodQuery.isCurrent = true;
  }

  const [period, grade, templateDoc] = await Promise.all([
    AcademicPeriod.findOne(periodQuery).select("_id yearLabel term isCurrent").lean(),
    Grade.findById(access.classGroup.gradeId).select("_id name").lean(),
    ReportTemplate.findOne({ schoolId: input.context.schoolId, isDefault: true }).lean(),
  ]);

  if (!period) {
    return { ok: false as const, error: "No active academic period found.", status: 400 as const };
  }

  if (!grade) {
    return { ok: false as const, error: "Grade not found for class group.", status: 404 as const };
  }

  const assessmentPlanDoc = await AssessmentPlan.findOne({
    schoolId: input.context.schoolId,
    academicPeriodId: period._id,
    appliesToGradeId: access.classGroup.gradeId,
    appliesToClassGroupIds: input.classGroupId,
    status: "active",
  }).lean();

  if (!assessmentPlanDoc) {
    return {
      ok: false as const,
      error: "No active assessment plan applies to this class group and term.",
      status: 400 as const,
    };
  }

  const gradingPolicyDoc = await AcademicGradingPolicy.findOne({
    _id: assessmentPlanDoc.gradingPolicyId,
    schoolId: input.context.schoolId,
    status: "active",
  }).lean();

  if (!gradingPolicyDoc) {
    return {
      ok: false as const,
      error: "Linked grading policy was not found or is not active.",
      status: 400 as const,
    };
  }

  const classGroupRef: TeacherGradebookClassGroupRef = {
    _id: String(access.classGroup._id),
    name: access.classGroup.name,
    label: `${grade.name} ${access.classGroup.name}`.trim(),
    gradeId: String(grade._id),
    gradeName: grade.name,
  };

  const academicPeriodRef: TeacherGradebookAcademicPeriodRef = {
    _id: String(period._id),
    yearLabel: period.yearLabel,
    term: period.term,
    isCurrent: period.isCurrent,
  };

  return {
    ok: true as const,
    classGroup: access.classGroup,
    classGroupRef,
    academicPeriodRef,
    academicPeriodId: period._id as mongoose.Types.ObjectId,
    gradeId: grade._id as mongoose.Types.ObjectId,
    assessmentPlan: serializeAssessmentPlan(assessmentPlanDoc),
    gradingPolicy: serializeGradingPolicy(gradingPolicyDoc),
    reportTemplateId: templateDoc?._id ?? null,
    reportTemplateDoc: templateDoc,
  };
}

async function buildTeacherNameMap(teacherIds: string[]) {
  const uniqueIds = [...new Set(teacherIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const teachers = await Teacher.find({
    _id: { $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id userId")
    .lean();

  const userIds = teachers.map((teacher) => teacher.userId).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id firstName lastName middleName")
    .lean();

  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const namesByTeacherId = new Map<string, string>();

  for (const teacher of teachers) {
    const user = usersById.get(String(teacher.userId));
    namesByTeacherId.set(
      String(teacher._id),
      user ? formatPersonName(user) : "Assigned teacher"
    );
  }

  return namesByTeacherId;
}

export async function buildReportCardRunSubjectReadiness(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  assessmentPlanId: mongoose.Types.ObjectId;
  studentsExpected: number;
}): Promise<ReportCardRunSubjectReadinessRow[]> {
  const assignments = await TeacherAssignment.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
    status: "active",
  })
    .select("subjectId teacherId")
    .lean();

  const subjectIds = [...new Set(assignments.map((entry) => String(entry.subjectId)))];
  if (subjectIds.length === 0) {
    return [];
  }

  const [subjects, subjectResults, teacherNames] = await Promise.all([
    Subject.find({
      _id: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: input.schoolId,
    })
      .select("_id name")
      .lean(),
    SubjectResult.find({
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      academicPeriodId: input.academicPeriodId,
      assessmentPlanId: input.assessmentPlanId,
      subjectId: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .select("subjectId status")
      .lean(),
    buildTeacherNameMap(assignments.map((entry) => String(entry.teacherId))),
  ]);

  const subjectsById = new Map(subjects.map((subject) => [String(subject._id), subject.name]));
  const assignmentBySubject = new Map<string, { teacherId: string }>();
  for (const assignment of assignments) {
    assignmentBySubject.set(String(assignment.subjectId), {
      teacherId: String(assignment.teacherId),
    });
  }

  const resultsBySubject = new Map<
    string,
    { submitted: number; approved: number; missingExam: number }
  >();

  for (const subjectId of subjectIds) {
    resultsBySubject.set(subjectId, { submitted: 0, approved: 0, missingExam: 0 });
  }

  for (const result of subjectResults) {
    const subjectId = String(result.subjectId);
    const bucket = resultsBySubject.get(subjectId);
    if (!bucket) continue;
    if (SUBJECT_RESULT_COMPLETE_STATUSES.has(result.status as SubjectResultStatus)) {
      bucket.submitted += 1;
    }
    if (result.status === "approved") {
      bucket.approved += 1;
    }
  }

  return subjectIds.map((subjectId) => {
    const bucket = resultsBySubject.get(subjectId) ?? {
      submitted: 0,
      approved: 0,
      missingExam: 0,
    };
    const assignment = assignmentBySubject.get(subjectId);
    const issues: string[] = [];

    let status: ReportCardRunSubjectReadinessRow["status"] = "missing";
    if (bucket.submitted === 0) {
      status = "missing";
      issues.push("No submitted subject results yet.");
    } else if (bucket.submitted < input.studentsExpected) {
      status = "partial";
      issues.push(
        `${input.studentsExpected - bucket.submitted} student result(s) still not submitted.`
      );
    } else if (bucket.approved === input.studentsExpected) {
      status = "approved";
    } else {
      status = "submitted";
    }

    return {
      subjectId,
      subjectName: subjectsById.get(subjectId) ?? "Subject",
      teacherId: assignment?.teacherId ?? null,
      teacherName: assignment?.teacherId ? teacherNames.get(assignment.teacherId) ?? null : null,
      submittedCount: bucket.submitted,
      approvedCount: bucket.approved,
      studentsExpected: input.studentsExpected,
      status,
      issues,
    };
  });
}

export async function buildReportCardRunReadiness(input: {
  schoolId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  assessmentPlanId: mongoose.Types.ObjectId;
  subjectReadiness: ReportCardRunSubjectReadinessRow[];
  studentsExpected: number;
}): Promise<{
  readinessSnapshot: ReportCardRunReadinessSnapshot;
  issueSummary: ReportCardRunIssueSummary[];
}> {
  const issueSummary: ReportCardRunIssueSummary[] = [];
  const subjectsExpected = input.subjectReadiness.length;
  const subjectsSubmitted = input.subjectReadiness.filter(
    (row) => row.status === "submitted" || row.status === "approved"
  ).length;
  const subjectsApproved = input.subjectReadiness.filter(
    (row) => row.status === "approved"
  ).length;

  const missingSubjectResults = input.subjectReadiness
    .filter((row) => row.status === "missing" || row.status === "partial")
    .map((row) => row.subjectId);

  if (missingSubjectResults.length > 0) {
    issueSummary.push({
      code: "MISSING_SUBJECT_RESULTS",
      message: `${missingSubjectResults.length} subject(s) still need submitted results.`,
      severity: "error",
      entityType: "report_run",
    });
  }

  const attendanceReady = await hasHomeroomAttendanceRecords({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    academicPeriodId: input.academicPeriodId,
  });

  if (!attendanceReady) {
    issueSummary.push({
      code: "ATTENDANCE_NOT_READY",
      message:
        "Attendance records are missing for this period. Record or review daily homeroom attendance before compiling reports.",
      severity: "error",
      entityType: "report_run",
    });
  }

  const commentsReady = false;
  const headteacherCommentReady = false;
  issueSummary.push({
    code: "COMMENTS_NOT_READY",
    message:
      "Report comments are not fully captured yet. Homeroom and headteacher comments will be required before release.",
    severity: "warning",
    entityType: "report_run",
  });

  const students = await Student.find({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    status: "active",
  })
    .select("_id")
    .lean();

  const subjectIds = input.subjectReadiness.map((row) => row.subjectId);
  const subjectResults = subjectIds.length
    ? await SubjectResult.find({
        schoolId: input.schoolId,
        classGroupId: input.classGroupId,
        academicPeriodId: input.academicPeriodId,
        assessmentPlanId: input.assessmentPlanId,
        subjectId: { $in: subjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: { $in: [...SUBJECT_RESULT_COMPLETE_STATUSES] },
      })
        .select("studentId subjectId")
        .lean()
    : [];

  const completePairs = new Set(
    subjectResults.map((result) => `${String(result.studentId)}:${String(result.subjectId)}`)
  );

  let studentsComplete = 0;
  for (const student of students) {
    const allSubjectsComplete =
      subjectIds.length > 0 &&
      subjectIds.every((subjectId) => completePairs.has(`${String(student._id)}:${subjectId}`));
    if (allSubjectsComplete) {
      studentsComplete += 1;
    }
  }

  if (students.length === 0) {
    issueSummary.push({
      code: "NO_ACTIVE_STUDENTS",
      message: "This class group has no active students.",
      severity: "error",
      entityType: "report_run",
    });
  }

  return {
    readinessSnapshot: {
      subjectsExpected,
      subjectsSubmitted,
      subjectsApproved,
      studentsExpected: input.studentsExpected,
      studentsComplete,
      missingSubjectResults,
      missingExamScores: [],
      missingRequiredComponents: [],
      attendanceReady,
      commentsReady,
      headteacherCommentReady,
    },
    issueSummary,
  };
}

function canCompileFromReadiness(
  readinessSnapshot: ReportCardRunReadinessSnapshot,
  issueSummary: ReportCardRunIssueSummary[]
) {
  const blockingIssues = issueSummary.filter((issue) => issue.severity === "error");
  return (
    blockingIssues.length === 0 &&
    readinessSnapshot.subjectsSubmitted === readinessSnapshot.subjectsExpected &&
    readinessSnapshot.subjectsExpected > 0 &&
    readinessSnapshot.studentsExpected > 0 &&
    readinessSnapshot.attendanceReady
  );
}

export async function hydrateReportCardRunDetail(
  runDoc: IReportCardRun | Record<string, unknown>,
  input: {
    classGroupRef: TeacherGradebookClassGroupRef;
    academicPeriodRef: TeacherGradebookAcademicPeriodRef;
  }
): Promise<ReportCardRunDetailDTO> {
  const run = serializeReportCardRun(runDoc);
  const studentsExpected = await Student.countDocuments({
    schoolId: new mongoose.Types.ObjectId(run.schoolId),
    classGroupId: new mongoose.Types.ObjectId(run.classGroupId),
    status: "active",
  });

  const subjectReadiness = await buildReportCardRunSubjectReadiness({
    schoolId: new mongoose.Types.ObjectId(run.schoolId),
    classGroupId: new mongoose.Types.ObjectId(run.classGroupId),
    academicPeriodId: new mongoose.Types.ObjectId(run.academicPeriodId),
    assessmentPlanId: new mongoose.Types.ObjectId(run.assessmentPlanId),
    studentsExpected,
  });

  const { readinessSnapshot, issueSummary } = await buildReportCardRunReadiness({
    schoolId: new mongoose.Types.ObjectId(run.schoolId),
    classGroupId: new mongoose.Types.ObjectId(run.classGroupId),
    academicPeriodId: new mongoose.Types.ObjectId(run.academicPeriodId),
    assessmentPlanId: new mongoose.Types.ObjectId(run.assessmentPlanId),
    subjectReadiness,
    studentsExpected,
  });

  const studentReportCardCount = await StudentReportCard.countDocuments({
    reportCardRunId: new mongoose.Types.ObjectId(run._id),
  });

  return {
    ...run,
    classGroup: input.classGroupRef,
    academicPeriod: input.academicPeriodRef,
    readinessSnapshot,
    issueSummary,
    subjectReadiness,
    studentReportCardCount,
  };
}

export async function listHomeroomReportRuns(
  context: HomeroomReportRunContext,
  options?: { academicPeriodId?: string | null; classGroupId?: string | null }
): Promise<
  | { ok: true; data: ReportCardRunListItemDTO[] }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const query: Record<string, unknown> = { schoolId: context.schoolId };

  if (options?.academicPeriodId) {
    const periodId = toObjectIdOrNull(options.academicPeriodId);
    if (!periodId) return { ok: false, error: "Invalid academic period", status: 400 };
    query.academicPeriodId = periodId;
  }

  if (options?.classGroupId) {
    const classGroupId = toObjectIdOrNull(options.classGroupId);
    if (!classGroupId) return { ok: false, error: "Invalid class group", status: 400 };
    const access = await assertHomeroomReportRunAccess(context, classGroupId);
    if (!access.ok) return access;
    query.classGroupId = classGroupId;
  } else if (!context.isAdmin) {
    query.homeroomTeacherId = context.teacherId;
  }

  const runs = await ReportCardRun.find(query).sort({ updatedAt: -1 }).lean();
  if (runs.length === 0) {
    return { ok: true, data: [] };
  }

  const classGroupIds = [...new Set(runs.map((run) => String(run.classGroupId)))];
  const periodIds = [...new Set(runs.map((run) => String(run.academicPeriodId)))];

  const [classGroups, grades, periods] = await Promise.all([
    ClassGroup.find({ _id: { $in: classGroupIds } }).select("_id name gradeId").lean(),
    Grade.find({ schoolId: context.schoolId }).select("_id name").lean(),
    AcademicPeriod.find({ _id: { $in: periodIds } }).select("_id yearLabel term").lean(),
  ]);

  const gradesById = new Map(grades.map((grade) => [String(grade._id), grade.name]));
  const classGroupsById = new Map(
    classGroups.map((group) => {
      const gradeName = group.gradeId ? gradesById.get(String(group.gradeId)) ?? "" : "";
      return [
        String(group._id),
        {
          _id: String(group._id),
          name: group.name,
          label: `${gradeName} ${group.name}`.trim(),
        },
      ];
    })
  );
  const periodsById = new Map(
    periods.map((period) => [
      String(period._id),
      {
        _id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
      },
    ])
  );

  return {
    ok: true,
    data: runs.map((run) => ({
      ...serializeReportCardRun(run),
      classGroup: classGroupsById.get(String(run.classGroupId)) ?? {
        _id: String(run.classGroupId),
        name: "Class",
        label: "Class",
      },
      academicPeriod: periodsById.get(String(run.academicPeriodId)) ?? {
        _id: String(run.academicPeriodId),
        yearLabel: "",
        term: "",
      },
    })),
  };
}

export async function openHomeroomReportRun(
  context: HomeroomReportRunContext,
  body: OpenReportCardRunBody
): Promise<
  | { ok: true; data: ReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 | 500 }
> {
  const classGroupId = toObjectIdOrNull(body.classGroupId);
  if (!classGroupId) {
    return { ok: false, error: "Invalid class group", status: 400 };
  }

  const academicPeriodId = body.academicPeriodId
    ? toObjectIdOrNull(body.academicPeriodId)
    : null;
  if (body.academicPeriodId && !academicPeriodId) {
    return { ok: false, error: "Invalid academic period", status: 400 };
  }

  const scope = await resolveReportRunScope({
    context,
    classGroupId,
    academicPeriodId,
  });
  if (!scope.ok) {
    return scope;
  }

  const existing = await ReportCardRun.findOne({
    schoolId: context.schoolId,
    academicPeriodId: scope.academicPeriodId,
    classGroupId,
  }).lean();

  if (existing && COMPILED_RUN_STATUSES.has(existing.status as ReportCardRunStatus)) {
    return {
      ok: false,
      error: "A compiled report run already exists for this class and term.",
      status: 409,
    };
  }

  const now = new Date();
  const runDoc = await ReportCardRun.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      academicPeriodId: scope.academicPeriodId,
      classGroupId,
    },
    {
      $set: {
        gradeId: scope.gradeId,
        homeroomTeacherId: context.teacherId,
        gradingPolicyId: new mongoose.Types.ObjectId(scope.gradingPolicy._id),
        assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
        reportTemplateId: scope.reportTemplateId,
        status: "opened",
        openedBy: context.userId,
        openedAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return {
    ok: true,
    data: await hydrateReportCardRunDetail(runDoc as IReportCardRun, {
      classGroupRef: scope.classGroupRef,
      academicPeriodRef: scope.academicPeriodRef,
    }),
  };
}

export async function getHomeroomReportRunById(
  context: HomeroomReportRunContext,
  reportRunId: string
): Promise<
  | { ok: true; data: ReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const runObjId = toObjectIdOrNull(reportRunId);
  if (!runObjId) {
    return { ok: false, error: "Invalid report run id", status: 400 };
  }

  const runDoc = await ReportCardRun.findOne({
    _id: runObjId,
    schoolId: context.schoolId,
  }).lean();

  if (!runDoc) {
    return { ok: false, error: "Report run not found", status: 404 };
  }

  const access = await assertHomeroomReportRunAccess(
    context,
    runDoc.classGroupId as mongoose.Types.ObjectId
  );
  if (!access.ok) {
    return access;
  }

  const [grade, period] = await Promise.all([
    Grade.findById(runDoc.gradeId).select("_id name").lean(),
    AcademicPeriod.findById(runDoc.academicPeriodId).select("_id yearLabel term isCurrent").lean(),
  ]);

  const classGroup = await ClassGroup.findById(runDoc.classGroupId).select("_id name").lean();
  if (!classGroup || !grade || !period) {
    return { ok: false, error: "Report run references missing class or period data.", status: 404 };
  }

  return {
    ok: true,
    data: await hydrateReportCardRunDetail(runDoc as IReportCardRun, {
      classGroupRef: {
        _id: String(classGroup._id),
        name: classGroup.name,
        label: `${grade.name} ${classGroup.name}`.trim(),
        gradeId: String(grade._id),
        gradeName: grade.name,
      },
      academicPeriodRef: {
        _id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        isCurrent: period.isCurrent,
      },
    }),
  };
}

async function assertRunMutableForCompile(run: IReportCardRun) {
  if (!COMPILE_ALLOWED_STATUSES.has(run.status)) {
    return {
      ok: false as const,
      error: `Report run cannot be compiled while status is "${run.status}".`,
      status: 409 as const,
    };
  }
  return { ok: true as const };
}

export async function compileHomeroomReportRun(
  context: HomeroomReportRunContext,
  reportRunId: string
): Promise<
  | { ok: true; data: ReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 | 500 }
> {
  const detailResult = await getHomeroomReportRunById(context, reportRunId);
  if (!detailResult.ok) {
    return detailResult;
  }

  const runDoc = await ReportCardRun.findById(reportRunId).lean();
  if (!runDoc) {
    return { ok: false, error: "Report run not found", status: 404 };
  }

  const mutable = await assertRunMutableForCompile(runDoc as IReportCardRun);
  if (!mutable.ok) {
    return mutable;
  }

  const detail = detailResult.data;
  if (
    !detail.readinessSnapshot ||
    !canCompileFromReadiness(detail.readinessSnapshot, detail.issueSummary ?? [])
  ) {
    return {
      ok: false,
      error: "Report run is not ready to compile. Resolve readiness issues first.",
      status: 400,
    };
  }

  const [school, gradingPolicyDoc, assessmentPlanDoc, templateDoc, students] = await Promise.all([
    School.findById(context.schoolId)
      .select("_id name logo motto address email city region gesSchoolCode curriculumCode")
      .lean(),
    AcademicGradingPolicy.findById(runDoc.gradingPolicyId).lean(),
    AssessmentPlan.findById(runDoc.assessmentPlanId).lean(),
    runDoc.reportTemplateId
      ? ReportTemplate.findById(runDoc.reportTemplateId).lean()
      : ReportTemplate.findOne({ schoolId: context.schoolId, isDefault: true }).lean(),
    Student.find({
      schoolId: context.schoolId,
      classGroupId: runDoc.classGroupId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo photoUrl gender dateOfBirth")
      .sort({ lastName: 1, firstName: 1 })
      .lean(),
  ]);

  if (!school || !gradingPolicyDoc || !assessmentPlanDoc) {
    return { ok: false, error: "Missing school or academic configuration for compilation.", status: 400 };
  }

  const gradingPolicySnapshot = serializeGradingPolicy(gradingPolicyDoc);
  const assessmentPlanSnapshot = serializeAssessmentPlan(assessmentPlanDoc);
  const reportTemplateSnapshot = templateDoc
    ? {
        _id: String(templateDoc._id),
        name: templateDoc.name,
        curriculumCode: templateDoc.curriculumCode,
        sections: templateDoc.sections,
        showClassPosition: templateDoc.showClassPosition,
        showAttendance: templateDoc.showAttendance,
        showConduct: templateDoc.showConduct,
        showGradingKey: templateDoc.showGradingKey,
        headerConfig: templateDoc.headerConfig ?? {},
      }
    : { name: "Default report template", sections: [] };

  const schoolSnapshot = {
    _id: String(school._id),
    name: school.name,
    logo: school.logo ?? null,
    motto: school.motto ?? null,
    address: school.address ?? null,
    email: school.email ?? null,
    city: school.city ?? null,
    region: school.region ?? null,
    gesSchoolCode: school.gesSchoolCode ?? null,
    curriculumCode: school.curriculumCode ?? null,
  };

  const subjectResults = await SubjectResult.find({
    schoolId: context.schoolId,
    classGroupId: runDoc.classGroupId,
    academicPeriodId: runDoc.academicPeriodId,
    assessmentPlanId: runDoc.assessmentPlanId,
    status: { $in: [...SUBJECT_RESULT_COMPLETE_STATUSES] },
  }).lean();

  const subjectResultsByStudent = new Map<string, typeof subjectResults>();
  for (const result of subjectResults) {
    const studentId = String(result.studentId);
    const bucket = subjectResultsByStudent.get(studentId) ?? [];
    bucket.push(result);
    subjectResultsByStudent.set(studentId, bucket);
  }

  const now = new Date();
  const runObjId = runDoc._id as mongoose.Types.ObjectId;

  for (const student of students) {
    const studentId = student._id as mongoose.Types.ObjectId;
    const attendanceSnapshot = await buildStudentReportCardAttendanceSnapshot({
      schoolId: context.schoolId,
      academicPeriodId: runDoc.academicPeriodId as mongoose.Types.ObjectId,
      reportCardRunId: runObjId,
      studentId,
      classGroupId: runDoc.classGroupId as mongoose.Types.ObjectId,
    });

    const studentSubjectResults = subjectResultsByStudent.get(String(studentId)) ?? [];
    const subjectResultsSnapshot = studentSubjectResults.map((result) => ({
      _id: String(result._id),
      subjectId: String(result.subjectId),
      teacherId: String(result.teacherId),
      finalScore: result.finalScore,
      roundedFinalScore: result.roundedFinalScore,
      gradeLabel: result.gradeLabel,
      gradePoint: result.gradePoint ?? null,
      descriptor: result.descriptor ?? null,
      isPassed: result.isPassed,
      subjectPosition: result.subjectPosition ?? null,
      subjectRemark: result.subjectRemark ?? null,
      components: result.components,
      status: result.status,
    }));

    const passedCount = studentSubjectResults.filter((result) => result.isPassed).length;
    const averageFinalScore =
      studentSubjectResults.length > 0
        ? Math.round(
            (studentSubjectResults.reduce(
              (sum, result) => sum + result.roundedFinalScore,
              0
            ) /
              studentSubjectResults.length) *
              10
          ) / 10
        : 0;

    await StudentReportCard.findOneAndUpdate(
      {
        reportCardRunId: runObjId,
        studentId,
      },
      {
        $set: {
          schoolId: context.schoolId,
          academicPeriodId: runDoc.academicPeriodId,
          classGroupId: runDoc.classGroupId,
          gradeId: runDoc.gradeId,
          gradingPolicySnapshot,
          assessmentPlanSnapshot,
          reportTemplateSnapshot,
          studentSnapshot: {
            _id: String(student._id),
            name: formatPersonName(student),
            admissionNo: student.admissionNo ?? null,
            photoUrl: student.photoUrl ?? null,
            gender: student.gender ?? null,
            dateOfBirth: student.dateOfBirth ?? null,
          },
          schoolSnapshot,
          attendanceSnapshot,
          subjectResultsSnapshot,
          termSummarySnapshot: {
            subjectCount: studentSubjectResults.length,
            passedSubjectCount: passedCount,
            averageFinalScore,
          },
          commentsSnapshot: {
            ready: false,
            homeroomComment: null,
            headteacherComment: null,
            subjectRemarks: studentSubjectResults
              .filter((result) => result.subjectRemark)
              .map((result) => ({
                subjectId: String(result.subjectId),
                remark: result.subjectRemark,
              })),
          },
          conductSnapshot: null,
          promotionSnapshot: null,
          status: "compiled",
          compiledAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const updatedRun = await ReportCardRun.findByIdAndUpdate(
    runObjId,
    {
      $set: {
        status: "compiled",
        compiledBy: context.userId,
        compiledAt: now,
        readinessSnapshot: detail.readinessSnapshot,
        issueSummary: detail.issueSummary ?? [],
      },
    },
    { new: true }
  ).lean();

  const [grade, period, classGroup] = await Promise.all([
    Grade.findById(updatedRun?.gradeId).select("_id name").lean(),
    AcademicPeriod.findById(updatedRun?.academicPeriodId)
      .select("_id yearLabel term isCurrent")
      .lean(),
    ClassGroup.findById(updatedRun?.classGroupId).select("_id name").lean(),
  ]);

  if (!updatedRun || !grade || !period || !classGroup) {
    return { ok: false, error: "Failed to load compiled report run.", status: 500 };
  }

  return {
    ok: true,
    data: await hydrateReportCardRunDetail(updatedRun as IReportCardRun, {
      classGroupRef: {
        _id: String(classGroup._id),
        name: classGroup.name,
        label: `${grade.name} ${classGroup.name}`.trim(),
        gradeId: String(grade._id),
        gradeName: grade.name,
      },
      academicPeriodRef: {
        _id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        isCurrent: period.isCurrent,
      },
    }),
  };
}

export async function submitHomeroomReportRun(
  context: HomeroomReportRunContext,
  reportRunId: string
): Promise<
  | { ok: true; data: ReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 | 500 }
> {
  const detailResult = await getHomeroomReportRunById(context, reportRunId);
  if (!detailResult.ok) {
    return detailResult;
  }

  const runDoc = await ReportCardRun.findById(reportRunId).lean();
  if (!runDoc) {
    return { ok: false, error: "Report run not found", status: 404 };
  }

  if (runDoc.status !== "compiled" && runDoc.status !== "returned") {
    return {
      ok: false,
      error: "Only compiled report runs can be submitted for approval.",
      status: 409,
    };
  }

  const studentReportCardCount = await StudentReportCard.countDocuments({
    reportCardRunId: runDoc._id,
    status: "compiled",
  });

  const studentsExpected = await Student.countDocuments({
    schoolId: context.schoolId,
    classGroupId: runDoc.classGroupId,
    status: "active",
  });

  if (studentReportCardCount < studentsExpected) {
    return {
      ok: false,
      error: "Compile student report cards before submitting for approval.",
      status: 400,
    };
  }

  const now = new Date();
  const updatedRun = await ReportCardRun.findByIdAndUpdate(
    runDoc._id,
    {
      $set: {
        status: "submitted_for_approval",
        submittedBy: context.userId,
        submittedAt: now,
        readinessSnapshot: detailResult.data.readinessSnapshot,
        issueSummary: detailResult.data.issueSummary ?? [],
      },
    },
    { new: true }
  ).lean();

  const [grade, period, classGroup] = await Promise.all([
    Grade.findById(updatedRun?.gradeId).select("_id name").lean(),
    AcademicPeriod.findById(updatedRun?.academicPeriodId)
      .select("_id yearLabel term isCurrent")
      .lean(),
    ClassGroup.findById(updatedRun?.classGroupId).select("_id name").lean(),
  ]);

  if (!updatedRun || !grade || !period || !classGroup) {
    return { ok: false, error: "Failed to load submitted report run.", status: 500 };
  }

  return {
    ok: true,
    data: await hydrateReportCardRunDetail(updatedRun as IReportCardRun, {
      classGroupRef: {
        _id: String(classGroup._id),
        name: classGroup.name,
        label: `${grade.name} ${classGroup.name}`.trim(),
        gradeId: String(grade._id),
        gradeName: grade.name,
      },
      academicPeriodRef: {
        _id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        isCurrent: period.isCurrent,
      },
    }),
  };
}

export { canCompileFromReadiness };
