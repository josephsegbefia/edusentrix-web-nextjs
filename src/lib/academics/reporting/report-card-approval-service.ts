import crypto from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { ReportApprovalLog, type IReportApprovalLog } from "@/models/ReportApprovalLog";
import { ReportCardRun, type IReportCardRun } from "@/models/ReportCardRun";
import { ReportVerification } from "@/models/ReportVerification";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { StudentReportCard } from "@/models/StudentReportCard";
import { SubjectResult } from "@/models/SubjectResult";
import {
  hydrateReportCardRunDetail,
  serializeReportCardRun,
} from "@/lib/academics/reporting/report-card-run-service";
import type {
  ReportApprovalLogDTO,
  ReportCardRunDetailDTO,
  ReportCardRunListItemDTO,
  ReportCardRunStatus,
  TeacherGradebookAcademicPeriodRef,
  TeacherGradebookClassGroupRef,
} from "@/types/academics/assessment-engine";

export const adminReportActionBodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const adminReportReleaseBodySchema = adminReportActionBodySchema.extend({
  releaseVisibility: z
    .object({
      parent: z.boolean().optional(),
      student: z.boolean().optional(),
    })
    .optional(),
});

export type AdminReportActionBody = z.infer<typeof adminReportActionBodySchema>;
export type AdminReportReleaseBody = z.infer<typeof adminReportReleaseBodySchema>;

export type AdminReportApprovalContext = {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  actorRole: string;
};

export type AdminReportCardRunDetailDTO = ReportCardRunDetailDTO & {
  approvalLogs: ReportApprovalLogDTO[];
};

function toObjectIdOrNull(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseAdminReportActionBody(
  body: unknown
): { ok: true; data: AdminReportActionBody } | { ok: false; error: string } {
  return parseBody(adminReportActionBodySchema, body);
}

export function parseAdminReportReleaseBody(
  body: unknown
): { ok: true; data: AdminReportReleaseBody } | { ok: false; error: string } {
  return parseBody(adminReportReleaseBodySchema, body);
}

export function canApproveReportRunStatus(status: ReportCardRunStatus) {
  return status === "submitted_for_approval";
}

export function canReturnReportRunStatus(status: ReportCardRunStatus) {
  return status === "submitted_for_approval" || status === "approved";
}

export function canReleaseReportRunStatus(status: ReportCardRunStatus) {
  return status === "approved";
}

export function serializeReportApprovalLog(
  doc: IReportApprovalLog | Record<string, unknown>
): ReportApprovalLogDTO {
  const row = doc as IReportApprovalLog;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    reportCardRunId: String(row.reportCardRunId),
    studentReportCardId: row.studentReportCardId ? String(row.studentReportCardId) : null,
    entityType: row.entityType,
    entityId: String(row.entityId),
    action: row.action,
    actorId: String(row.actorId),
    actorRole: row.actorRole,
    note: row.note ?? null,
    beforeStatus: row.beforeStatus ?? null,
    afterStatus: row.afterStatus ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
  };
}

async function loadReportRunRefs(runDoc: IReportCardRun): Promise<
  | {
      ok: true;
      classGroupRef: TeacherGradebookClassGroupRef;
      academicPeriodRef: TeacherGradebookAcademicPeriodRef;
    }
  | { ok: false; error: string; status: 404 }
> {
  const [grade, period, classGroup] = await Promise.all([
    Grade.findById(runDoc.gradeId).select("_id name").lean(),
    AcademicPeriod.findById(runDoc.academicPeriodId)
      .select("_id yearLabel term isCurrent")
      .lean(),
    ClassGroup.findById(runDoc.classGroupId).select("_id name").lean(),
  ]);

  if (!classGroup || !grade || !period) {
    return { ok: false, error: "Report run references missing class or period data.", status: 404 };
  }

  return {
    ok: true,
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
  };
}

async function loadAdminReportRunDetail(
  runDoc: IReportCardRun
): Promise<
  | { ok: true; data: AdminReportCardRunDetailDTO }
  | { ok: false; error: string; status: 404 }
> {
  const refs = await loadReportRunRefs(runDoc);
  if (!refs.ok) {
    return refs;
  }

  const [detail, approvalLogs] = await Promise.all([
    hydrateReportCardRunDetail(runDoc, {
      classGroupRef: refs.classGroupRef,
      academicPeriodRef: refs.academicPeriodRef,
    }),
    ReportApprovalLog.find({ reportCardRunId: runDoc._id })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return {
    ok: true,
    data: {
      ...detail,
      approvalLogs: approvalLogs.map((entry) => serializeReportApprovalLog(entry)),
    },
  };
}

async function writeReportApprovalLog(input: {
  context: AdminReportApprovalContext;
  reportCardRunId: mongoose.Types.ObjectId;
  entityType: "report_run" | "student_report_card" | "subject_result";
  entityId: mongoose.Types.ObjectId;
  action: "approve" | "return" | "release";
  beforeStatus: string;
  afterStatus: string;
  note?: string | null;
  studentReportCardId?: mongoose.Types.ObjectId | null;
  metadata?: Record<string, unknown> | null;
}) {
  await ReportApprovalLog.create({
    schoolId: input.context.schoolId,
    reportCardRunId: input.reportCardRunId,
    studentReportCardId: input.studentReportCardId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.context.userId,
    actorRole: input.context.actorRole,
    note: input.note ?? null,
    beforeStatus: input.beforeStatus,
    afterStatus: input.afterStatus,
    metadata: input.metadata ?? null,
  });
}

async function createStudentReportCardVerificationId() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const token = crypto.randomBytes(6).toString("hex").toUpperCase();
    const verificationId = `RC-${stamp}-${token}`;
    const existing = await ReportVerification.exists({ verificationId });
    if (!existing) return verificationId;
  }

  throw new Error("Could not allocate report card verification ID");
}

async function issueStudentReportCardVerification(input: {
  context: AdminReportApprovalContext;
  schoolName: string;
  studentReportCardId: mongoose.Types.ObjectId;
  studentName: string;
  periodLabel: string;
  startDate: Date;
  endDate: Date;
  classGroupLabel: string;
}) {
  const verificationId = await createStudentReportCardVerificationId();
  const reportLabel = `Report Card - ${input.studentName} - ${input.periodLabel}`;

  const verificationPayload = {
    verificationId,
    reportType: "term_report" as const,
    status: "issued" as const,
    schoolId: input.context.schoolId,
    schoolName: input.schoolName,
    issuedBy: input.context.userId,
    reportLabel,
    range: {
      startDate: input.startDate,
      endDate: input.endDate,
      source: "student_report_card",
      periodLabel: input.periodLabel,
    },
    meta: {
      categories: ["academic", "report_card"],
      version: 1,
      studentReportCardId: String(input.studentReportCardId),
      classGroupLabel: input.classGroupLabel,
    },
    issuedAt: new Date(),
  };

  try {
    return await ReportVerification.create(verificationPayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("enum")) {
      throw error;
    }
    const now = new Date();
    const inserted = await ReportVerification.collection.insertOne({
      ...verificationPayload,
      createdAt: now,
      updatedAt: now,
    });
    return {
      _id: inserted.insertedId,
      verificationId,
    };
  }
}

export async function listAdminReportRuns(
  context: AdminReportApprovalContext,
  options?: {
    status?: string | null;
    academicPeriodId?: string | null;
    classGroupId?: string | null;
  }
): Promise<
  | { ok: true; data: ReportCardRunListItemDTO[] }
  | { ok: false; error: string; status: 400 }
> {
  const query: Record<string, unknown> = { schoolId: context.schoolId };

  if (options?.status) {
    query.status = options.status;
  }

  if (options?.academicPeriodId) {
    const periodId = toObjectIdOrNull(options.academicPeriodId);
    if (!periodId) return { ok: false, error: "Invalid academic period", status: 400 };
    query.academicPeriodId = periodId;
  }

  if (options?.classGroupId) {
    const classGroupId = toObjectIdOrNull(options.classGroupId);
    if (!classGroupId) return { ok: false, error: "Invalid class group", status: 400 };
    query.classGroupId = classGroupId;
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

export async function getAdminReportRunById(
  context: AdminReportApprovalContext,
  reportRunId: string
): Promise<
  | { ok: true; data: AdminReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 404 }
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

  return loadAdminReportRunDetail(runDoc as IReportCardRun);
}

export async function approveAdminReportRun(
  context: AdminReportApprovalContext,
  reportRunId: string,
  body: AdminReportActionBody
): Promise<
  | { ok: true; data: AdminReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 404 | 409 | 500 }
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

  const beforeStatus = runDoc.status as ReportCardRunStatus;
  if (!canApproveReportRunStatus(beforeStatus)) {
    return {
      ok: false,
      error: `Report run cannot be approved while status is "${beforeStatus}".`,
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
      error: "Student report cards are incomplete for this run.",
      status: 400,
    };
  }

  const now = new Date();
  const afterStatus: ReportCardRunStatus = "approved";

  await Promise.all([
    ReportCardRun.findByIdAndUpdate(runDoc._id, {
      $set: {
        status: afterStatus,
        approvedBy: context.userId,
        approvedAt: now,
      },
    }),
    StudentReportCard.updateMany(
      { reportCardRunId: runDoc._id, status: "compiled" },
      { $set: { status: "approved", approvedAt: now } }
    ),
    SubjectResult.updateMany(
      {
        schoolId: context.schoolId,
        classGroupId: runDoc.classGroupId,
        academicPeriodId: runDoc.academicPeriodId,
        assessmentPlanId: runDoc.assessmentPlanId,
        status: "submitted",
      },
      {
        $set: {
          status: "approved",
          approvedBy: context.userId,
          approvedAt: now,
        },
      }
    ),
  ]);

  await writeReportApprovalLog({
    context,
    reportCardRunId: runDoc._id as mongoose.Types.ObjectId,
    entityType: "report_run",
    entityId: runDoc._id as mongoose.Types.ObjectId,
    action: "approve",
    beforeStatus,
    afterStatus,
    note: body.note ?? null,
    metadata: {
      studentReportCardCount,
      studentsExpected,
    },
  });

  const updatedRun = await ReportCardRun.findById(runDoc._id).lean();
  if (!updatedRun) {
    return { ok: false, error: "Failed to load approved report run.", status: 500 };
  }

  const detailResult = await loadAdminReportRunDetail(updatedRun as IReportCardRun);
  if (!detailResult.ok) {
    return detailResult;
  }

  return { ok: true, data: detailResult.data };
}

export async function returnAdminReportRun(
  context: AdminReportApprovalContext,
  reportRunId: string,
  body: AdminReportActionBody
): Promise<
  | { ok: true; data: AdminReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 404 | 409 | 500 }
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

  const beforeStatus = runDoc.status as ReportCardRunStatus;
  if (!canReturnReportRunStatus(beforeStatus)) {
    return {
      ok: false,
      error: `Report run cannot be returned while status is "${beforeStatus}".`,
      status: 409,
    };
  }

  if (!body.note?.trim()) {
    return {
      ok: false,
      error: "A return note is required so the homeroom teacher knows what to fix.",
      status: 400,
    };
  }

  const afterStatus: ReportCardRunStatus = "returned";

  await ReportCardRun.findByIdAndUpdate(runDoc._id, {
    $set: {
      status: afterStatus,
      approvedBy: null,
      approvedAt: null,
    },
  });

  await writeReportApprovalLog({
    context,
    reportCardRunId: runDoc._id as mongoose.Types.ObjectId,
    entityType: "report_run",
    entityId: runDoc._id as mongoose.Types.ObjectId,
    action: "return",
    beforeStatus,
    afterStatus,
    note: body.note.trim(),
  });

  const updatedRun = await ReportCardRun.findById(runDoc._id).lean();
  if (!updatedRun) {
    return { ok: false, error: "Failed to load returned report run.", status: 500 };
  }

  const detailResult = await loadAdminReportRunDetail(updatedRun as IReportCardRun);
  if (!detailResult.ok) {
    return detailResult;
  }

  return { ok: true, data: detailResult.data };
}

export async function releaseAdminReportRun(
  context: AdminReportApprovalContext,
  reportRunId: string,
  body: AdminReportReleaseBody
): Promise<
  | { ok: true; data: AdminReportCardRunDetailDTO }
  | { ok: false; error: string; status: 400 | 404 | 409 | 500 }
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

  const beforeStatus = runDoc.status as ReportCardRunStatus;
  if (!canReleaseReportRunStatus(beforeStatus)) {
    return {
      ok: false,
      error: `Report run cannot be released while status is "${beforeStatus}".`,
      status: 409,
    };
  }

  const [school, period, refs, studentReportCards] = await Promise.all([
    School.findById(context.schoolId).select("name").lean(),
    AcademicPeriod.findById(runDoc.academicPeriodId)
      .select("yearLabel term startDate endDate")
      .lean(),
    loadReportRunRefs(runDoc as IReportCardRun),
    StudentReportCard.find({
      reportCardRunId: runDoc._id,
      status: "approved",
    }).lean(),
  ]);

  if (!school || !period || !refs.ok) {
    return { ok: false, error: "Missing school or period data for release.", status: 400 };
  }

  if (studentReportCards.length === 0) {
    return {
      ok: false,
      error: "No approved student report cards found for this run.",
      status: 400,
    };
  }

  const schoolName =
    typeof school.name === "string" && school.name.trim() ? school.name.trim() : "Your School";
  const periodLabel = `${period.term} ${period.yearLabel}`.trim();
  const startDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  const now = new Date();
  const afterStatus: ReportCardRunStatus = "released";
  const releaseVisibility = body.releaseVisibility ?? {
    parent: true,
    student: true,
  };

  let verificationCount = 0;

  for (const card of studentReportCards) {
    const studentSnapshot = card.studentSnapshot as { name?: string | null } | undefined;
    const studentName =
      typeof studentSnapshot?.name === "string" && studentSnapshot.name.trim()
        ? studentSnapshot.name.trim()
        : "Student";

    const verification = await issueStudentReportCardVerification({
      context,
      schoolName,
      studentReportCardId: card._id as mongoose.Types.ObjectId,
      studentName,
      periodLabel,
      startDate,
      endDate,
      classGroupLabel: refs.classGroupRef.label,
    });

    await StudentReportCard.findByIdAndUpdate(card._id, {
      $set: {
        status: "released",
        releasedAt: now,
        verificationId: verification._id,
      },
    });

    await writeReportApprovalLog({
      context,
      reportCardRunId: runDoc._id as mongoose.Types.ObjectId,
      entityType: "student_report_card",
      entityId: card._id as mongoose.Types.ObjectId,
      action: "release",
      beforeStatus: "approved",
      afterStatus: "released",
      note: body.note ?? null,
      studentReportCardId: card._id as mongoose.Types.ObjectId,
      metadata: {
        verificationId: verification.verificationId,
      },
    });

    verificationCount += 1;
  }

  await Promise.all([
    ReportCardRun.findByIdAndUpdate(runDoc._id, {
      $set: {
        status: afterStatus,
        releasedBy: context.userId,
        releasedAt: now,
        releaseVisibility,
      },
    }),
    SubjectResult.updateMany(
      {
        schoolId: context.schoolId,
        classGroupId: runDoc.classGroupId,
        academicPeriodId: runDoc.academicPeriodId,
        assessmentPlanId: runDoc.assessmentPlanId,
        status: { $in: ["submitted", "approved"] },
      },
      {
        $set: {
          status: "locked",
          lockedAt: now,
        },
      }
    ),
  ]);

  await writeReportApprovalLog({
    context,
    reportCardRunId: runDoc._id as mongoose.Types.ObjectId,
    entityType: "report_run",
    entityId: runDoc._id as mongoose.Types.ObjectId,
    action: "release",
    beforeStatus,
    afterStatus,
    note: body.note ?? null,
    metadata: {
      verificationCount,
      releaseVisibility,
    },
  });

  const updatedRun = await ReportCardRun.findById(runDoc._id).lean();
  if (!updatedRun) {
    return { ok: false, error: "Failed to load released report run.", status: 500 };
  }

  const detailResult = await loadAdminReportRunDetail(updatedRun as IReportCardRun);
  if (!detailResult.ok) {
    return detailResult;
  }

  return { ok: true, data: detailResult.data };
}
