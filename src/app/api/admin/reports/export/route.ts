import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { recordActivity } from "@/lib/audit/recordActivity";
import { formatAmount } from "@/lib/fees/money";
import { Activity } from "@/models/Activity";
import { Invitation } from "@/models/Invitation";
import { Invoice } from "@/models/Invoice";
import { Payment } from "@/models/Payment";
import { ReportExport } from "@/models/ReportExport";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectGrade } from "@/models/SubjectGrade";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import {
  REPORT_DEFINITIONS,
  type ReportKey,
  type ReportRangeMode,
} from "@/constants/reports";

const DEFAULT_EXPORT_LIMIT = 5000;

type ExportRow = Array<string | number | null>;
type ReportBuilderResult = {
  headers: string[];
  rows: ExportRow[];
};
type ReportBuilderContext = {
  schoolId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  periodId: mongoose.Types.ObjectId | null;
  filters: Record<string, unknown>;
  limit: number;
  rangeMode: ReportRangeMode;
};

type UserInfo = {
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
};

function formatDate(value?: Date | string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().split("T")[0];
}

function formatName(first?: string, last?: string, fallback?: string): string {
  const name = `${first || ""} ${last || ""}`.trim();
  if (name) return name;
  if (fallback) return fallback;
  return "—";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(headers: string[], rows: ExportRow[]): string {
  const lines = [
    headers.map((cell) => escapeCsv(String(cell))).join(","),
    ...rows.map((row) =>
      row.map((cell) => escapeCsv(String(cell ?? ""))).join(",")
    ),
  ];
  return lines.join("\n");
}

function toObjectId(value?: string | null) {
  if (!value) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function getStringFilter(filters: Record<string, unknown>, key: string) {
  const value = filters[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function resolveRangeQuery(rangeMode: ReportRangeMode, ctx: ReportBuilderContext) {
  if (rangeMode === "all_time") {
    return {};
  }
  return { $gte: ctx.startDate, $lte: ctx.endDate };
}

async function buildFeesOverview(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const [paymentsAgg, billedAgg, outstandingAgg, overdueCount] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          schoolId: ctx.schoolId,
          status: "completed",
          paymentDate: { $gte: ctx.startDate, $lte: ctx.endDate },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: ctx.schoolId,
          status: { $ne: "draft" },
          $or: [
            { issueDate: { $gte: ctx.startDate, $lte: ctx.endDate } },
            { issueDate: null, createdAt: { $gte: ctx.startDate, $lte: ctx.endDate } },
          ],
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmountMinor" }, count: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      {
        $match: {
          schoolId: ctx.schoolId,
          status: { $in: ["issued", "partially_paid", "overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalOutstandingMinor" } } },
    ]),
    Invoice.countDocuments({ schoolId: ctx.schoolId, status: "overdue" }),
  ]);

  const revenueMinor = paymentsAgg[0]?.total ?? 0;
  const paymentsCount = paymentsAgg[0]?.count ?? 0;
  const billedMinor = billedAgg[0]?.total ?? 0;
  const invoicesCount = billedAgg[0]?.count ?? 0;
  const outstandingMinor = outstandingAgg[0]?.total ?? 0;
  const collectionRate =
    billedMinor > 0 ? (revenueMinor / billedMinor) * 100 : 0;

  return {
    headers: ["Metric", "Value"],
    rows: [
      ["Revenue (GHS)", formatAmount(revenueMinor)],
      ["Billed (GHS)", formatAmount(billedMinor)],
      ["Outstanding (GHS)", formatAmount(outstandingMinor)],
      ["Collection Rate (%)", collectionRate.toFixed(2)],
      ["Payments Count", paymentsCount],
      ["Invoices Count", invoicesCount],
      ["Overdue Invoices", overdueCount],
    ],
  };
}

async function buildFeesDefaulters(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const match: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    status: { $in: ["issued", "partially_paid", "overdue"] },
    totalOutstandingMinor: { $gt: 0 },
  };

  if (ctx.periodId) {
    match.academicPeriodId = ctx.periodId;
  } else {
    match.dueDate = resolveRangeQuery("range", ctx);
  }

  const defaulters = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$studentId",
        totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
        invoiceCount: { $sum: 1 },
        latestDueDate: { $max: "$dueDate" },
      },
    },
    { $sort: { totalOutstandingMinor: -1 } },
    { $limit: ctx.limit },
    {
      $lookup: {
        from: "students",
        localField: "_id",
        foreignField: "_id",
        as: "student",
      },
    },
    { $unwind: "$student" },
    {
      $project: {
        student: 1,
        totalOutstandingMinor: 1,
        invoiceCount: 1,
        latestDueDate: 1,
      },
    },
  ]);

  const rows = defaulters.map((item) => {
    const student = item.student as { firstName?: string; lastName?: string; admissionNo?: string };
    return [
      formatName(student?.firstName, student?.lastName),
      student?.admissionNo || "—",
      formatAmount(item.totalOutstandingMinor ?? 0),
      item.invoiceCount ?? 0,
      formatDate(item.latestDueDate as Date | null),
    ];
  });

  return {
    headers: ["Student", "Admission No", "Outstanding (GHS)", "Invoice Count", "Latest Due Date"],
    rows,
  };
}

async function buildFeesPayments(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const query: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    status: "completed",
    paymentDate: resolveRangeQuery("range", ctx),
  };

  const method = getStringFilter(ctx.filters, "paymentMethod") || getStringFilter(ctx.filters, "method");
  if (method) {
    query.paymentMethod = method;
  }

  const payments = (await Payment.find(query)
    .sort({ paymentDate: -1 })
    .limit(ctx.limit)
    .populate("studentId", "firstName lastName admissionNo")
    .populate("invoiceId", "invoiceNumber")
    .lean()) as Array<{
    paymentDate?: Date;
    amountMinor?: number;
    paymentMethod?: string;
    status?: string;
    studentId?: { firstName?: string; lastName?: string; admissionNo?: string } | null;
    invoiceId?: { invoiceNumber?: string } | null;
  }>;

  const rows = payments.map((payment) => {
    const student = payment.studentId;
    const invoice = payment.invoiceId;
    return [
      formatDate(payment.paymentDate || null),
      formatName(student?.firstName, student?.lastName),
      student?.admissionNo || "—",
      invoice?.invoiceNumber || "—",
      payment.paymentMethod || "—",
      payment.status || "—",
      formatAmount(payment.amountMinor ?? 0),
    ];
  });

  return {
    headers: [
      "Payment Date",
      "Student",
      "Admission No",
      "Invoice",
      "Method",
      "Status",
      "Amount (GHS)",
    ],
    rows,
  };
}

async function buildStudentsRoster(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const query: Record<string, unknown> = {
    schoolId: ctx.schoolId,
  };

  const gradeId = getStringFilter(ctx.filters, "gradeId");
  const classGroupId = getStringFilter(ctx.filters, "classGroupId");
  const status = getStringFilter(ctx.filters, "status");

  if (gradeId) {
    const gradeObjId = toObjectId(gradeId);
    if (gradeObjId) query.gradeId = gradeObjId;
  }
  if (classGroupId) {
    const classGroupObjId = toObjectId(classGroupId);
    if (classGroupObjId) query.classGroupId = classGroupObjId;
  }
  if (status) {
    query.status = status;
  }

  const students = (await Student.find(query)
    .sort({ lastName: 1, firstName: 1 })
    .limit(ctx.limit)
    .populate("gradeId", "name")
    .populate("classGroupId", "name")
    .lean()) as Array<{
    firstName: string;
    lastName: string;
    middleName?: string | null;
    admissionNo?: string | null;
    sex?: string | null;
    status?: string | null;
    enrolledAt?: Date | null;
    createdAt?: Date | null;
    gradeId?: { name?: string } | null;
    classGroupId?: { name?: string } | null;
  }>;

  const rows = students.map((student) => [
    student.admissionNo || "—",
    formatName(student.firstName, student.lastName),
    student.gradeId?.name || "—",
    student.classGroupId?.name || "—",
    student.status || "—",
    student.sex || "—",
    formatDate(student.enrolledAt || null),
    formatDate(student.createdAt || null),
  ]);

  return {
    headers: [
      "Admission No",
      "Student",
      "Grade",
      "Class",
      "Status",
      "Sex",
      "Enrolled At",
      "Created At",
    ],
    rows,
  };
}

async function buildTeachersRoster(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const query: Record<string, unknown> = { schoolId: ctx.schoolId };

  const status = getStringFilter(ctx.filters, "status");
  const department = getStringFilter(ctx.filters, "department");
  if (status) query.status = status;
  if (department) query.department = department;

  const teachers = await Teacher.aggregate([
    { $match: query },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $addFields: {
        subjectCount: { $size: { $ifNull: ["$subjectIds", []] } },
        hasHomeroom: {
          $cond: [{ $ifNull: ["$homeroomClassGroupId", false] }, "Yes", "No"],
        },
      },
    },
    { $sort: { "user.lastName": 1, "user.firstName": 1 } },
    { $limit: ctx.limit },
    {
      $project: {
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
        status: 1,
        department: 1,
        employeeId: 1,
        hireDate: 1,
        subjectCount: 1,
        hasHomeroom: 1,
      },
    },
  ]);

  const rows = teachers.map((teacher) => [
    formatName(teacher.firstName as string | undefined, teacher.lastName as string | undefined),
    teacher.email ? String(teacher.email) : "—",
    teacher.status ? String(teacher.status) : "—",
    teacher.department ? String(teacher.department) : "—",
    teacher.employeeId ? String(teacher.employeeId) : "—",
    teacher.subjectCount ? String(teacher.subjectCount) : "0",
    teacher.hasHomeroom ? String(teacher.hasHomeroom) : "No",
    formatDate(teacher.hireDate as Date | null),
  ]);

  return {
    headers: [
      "Teacher",
      "Email",
      "Status",
      "Department",
      "Employee ID",
      "Subjects",
      "Homeroom",
      "Hire Date",
    ],
    rows,
  };
}

async function buildTeachersWorkload(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const match: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    status: "active",
  };

  if (ctx.periodId) {
    match.academicPeriodId = ctx.periodId;
  } else {
    match.assignedAt = resolveRangeQuery("range", ctx);
  }

  const workload = await TeacherAssignment.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$teacherId",
        assignments: { $sum: 1 },
        subjects: { $addToSet: "$subjectId" },
        classGroups: { $addToSet: "$classGroupId" },
      },
    },
    {
      $project: {
        assignments: 1,
        subjectCount: { $size: "$subjects" },
        classCount: { $size: "$classGroups" },
      },
    },
    { $sort: { assignments: -1 } },
    { $limit: ctx.limit },
    {
      $lookup: {
        from: "teachers",
        localField: "_id",
        foreignField: "_id",
        as: "teacher",
      },
    },
    { $unwind: "$teacher" },
    {
      $lookup: {
        from: "users",
        localField: "teacher.userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        assignments: 1,
        subjectCount: 1,
        classCount: 1,
        status: "$teacher.status",
        department: "$teacher.department",
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
      },
    },
  ]);

  const rows = workload.map((item) => [
    formatName(item.firstName as string | undefined, item.lastName as string | undefined),
    item.email ? String(item.email) : "—",
    item.department ? String(item.department) : "—",
    item.status ? String(item.status) : "—",
    item.assignments ?? 0,
    item.subjectCount ?? 0,
    item.classCount ?? 0,
  ]);

  return {
    headers: [
      "Teacher",
      "Email",
      "Department",
      "Status",
      "Assignments",
      "Subjects",
      "Classes",
    ],
    rows,
  };
}

async function buildAttendanceSummary(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const match: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    date: resolveRangeQuery("range", ctx),
  };

  const statusFilter = getStringFilter(ctx.filters, "status");
  if (statusFilter) {
    match.status = statusFilter;
  }

  const attendance = await TeacherAttendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: { teacherId: "$teacherId", status: "$status" },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: "$_id.teacherId",
        total: { $sum: "$count" },
        counts: { $push: { status: "$_id.status", count: "$count" } },
      },
    },
    { $sort: { total: -1 } },
    { $limit: ctx.limit },
    {
      $lookup: {
        from: "teachers",
        localField: "_id",
        foreignField: "_id",
        as: "teacher",
      },
    },
    { $unwind: "$teacher" },
    {
      $lookup: {
        from: "users",
        localField: "teacher.userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        total: 1,
        counts: 1,
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
        department: "$teacher.department",
      },
    },
  ]);

  const rows = attendance.map((item) => {
    const counts = {
      present: 0,
      late: 0,
      absent: 0,
      on_leave: 0,
      sick: 0,
      other: 0,
    };
    const entries = item.counts as Array<{ status: string; count: number }>;
    for (const entry of entries) {
      if (entry.status in counts) {
        counts[entry.status as keyof typeof counts] = entry.count ?? 0;
      }
    }
    const total = item.total ?? 0;
    const presentTotal = counts.present + counts.late;
    const presentRate = total > 0 ? ((presentTotal / total) * 100).toFixed(1) : "0";
    return [
      formatName(item.firstName as string | undefined, item.lastName as string | undefined),
      item.email ? String(item.email) : "—",
      item.department ? String(item.department) : "—",
      counts.present,
      counts.late,
      counts.absent,
      counts.on_leave,
      counts.sick,
      counts.other,
      total,
      presentRate,
    ];
  });

  return {
    headers: [
      "Teacher",
      "Email",
      "Department",
      "Present",
      "Late",
      "Absent",
      "On Leave",
      "Sick",
      "Other",
      "Total",
      "Present Rate (%)",
    ],
    rows,
  };
}

async function buildInvitationsLog(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const query: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    createdAt: resolveRangeQuery("range", ctx),
  };

  const status = getStringFilter(ctx.filters, "status");
  const role = getStringFilter(ctx.filters, "role");
  if (status) query.status = status;
  if (role) query.role = role;

  const invitations = (await Invitation.find(query)
    .sort({ sentAt: -1 })
    .limit(ctx.limit)
    .populate("invitedBy", "firstName lastName email")
    .lean()) as Array<{
    email?: string;
    role?: string;
    status?: string;
    sentAt?: Date;
    expiresAt?: Date;
    acceptedAt?: Date | null;
    resendCount?: number;
    invitedBy?: UserInfo | null;
  }>;

  const rows = invitations.map((inv) => [
    inv.email || "—",
    inv.role || "—",
    inv.status || "—",
    formatDate(inv.sentAt || null),
    formatDate(inv.expiresAt || null),
    formatDate(inv.acceptedAt || null),
    inv.resendCount ?? 0,
    formatName(inv.invitedBy?.firstName, inv.invitedBy?.lastName, inv.invitedBy?.email),
  ]);

  return {
    headers: [
      "Email",
      "Role",
      "Status",
      "Sent Date",
      "Expires Date",
      "Accepted Date",
      "Resend Count",
      "Invited By",
    ],
    rows,
  };
}

async function buildAcademicsSummary(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const match: Record<string, unknown> = {
    schoolId: ctx.schoolId,
  };

  if (ctx.periodId) {
    match.academicPeriodId = ctx.periodId;
  } else {
    match.lastUpdated = resolveRangeQuery("range", ctx);
  }

  const subjectAgg = await SubjectGrade.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$subjectId",
        avgScore: { $avg: "$totalScore" },
        passRate: { $avg: { $cond: ["$isPassed", 1, 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: ctx.limit },
  ]);

  const subjectIds = subjectAgg
    .map((row) => row._id)
    .filter(Boolean) as mongoose.Types.ObjectId[];

  const subjects = subjectIds.length
    ? await Subject.find({ _id: { $in: subjectIds } }).lean()
    : [];

  const subjectMap = new Map<string, string>();
  for (const subject of subjects) {
    subjectMap.set(String(subject._id), subject.name);
  }

  const rows = subjectAgg.map((row) => [
    subjectMap.get(String(row._id)) || "Unknown",
    Number(row.avgScore ?? 0).toFixed(1),
    Number((row.passRate ?? 0) * 100).toFixed(1),
    row.count ?? 0,
  ]);

  return {
    headers: ["Subject", "Average Score", "Pass Rate (%)", "Records"],
    rows,
  };
}

async function buildActivityLog(ctx: ReportBuilderContext): Promise<ReportBuilderResult> {
  const activities = (await Activity.find({
    schoolId: ctx.schoolId,
    createdAt: resolveRangeQuery("range", ctx),
  })
    .sort({ createdAt: -1 })
    .limit(ctx.limit)
    .populate("userId", "firstName lastName email")
    .lean()) as Array<{
    type?: string;
    description?: string;
    createdAt?: Date;
    userId?: UserInfo | null;
  }>;

  const rows = activities.map((item) => [
    formatDate(item.createdAt || null),
    item.type || "—",
    item.description || "—",
    formatName(item.userId?.firstName, item.userId?.lastName, item.userId?.email),
  ]);

  return {
    headers: ["Date", "Type", "Description", "User"],
    rows,
  };
}

const REPORT_BUILDERS: Record<
  ReportKey,
  (ctx: ReportBuilderContext) => Promise<ReportBuilderResult>
> = {
  "fees.overview": buildFeesOverview,
  "fees.defaulters": buildFeesDefaulters,
  "fees.payments": buildFeesPayments,
  "students.roster": buildStudentsRoster,
  "teachers.roster": buildTeachersRoster,
  "teachers.workload": buildTeachersWorkload,
  "attendance.summary": buildAttendanceSummary,
  "invitations.log": buildInvitationsLog,
  "academics.summary": buildAcademicsSummary,
  "activity.log": buildActivityLog,
};

export async function GET(req: NextRequest) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  if (!schoolId) {
    return NextResponse.json({ error: "School ID not found" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const exportId = searchParams.get("exportId");
  if (!exportId || !mongoose.Types.ObjectId.isValid(exportId)) {
    return NextResponse.json({ error: "Invalid exportId" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const exportDoc = await ReportExport.findOne({
    _id: exportId,
    schoolId: schoolIdObj,
  });

  if (!exportDoc) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const definition = REPORT_DEFINITIONS[exportDoc.reportKey as ReportKey];
  if (!definition) {
    return NextResponse.json({ error: "Unknown report key" }, { status: 400 });
  }

  if (exportDoc.format !== "csv") {
    return NextResponse.json(
      { error: "Only CSV exports are supported currently" },
      { status: 400 }
    );
  }

  exportDoc.status = "processing";
  await exportDoc.save();

  const startDate = exportDoc.range?.startDate ?? new Date();
  const endDate = exportDoc.range?.endDate ?? new Date();
  const periodId = exportDoc.range?.periodId
    ? new mongoose.Types.ObjectId(String(exportDoc.range.periodId))
    : null;
  const filters =
    exportDoc.filters && typeof exportDoc.filters === "object"
      ? (exportDoc.filters as Record<string, unknown>)
      : {};
  const limit =
    exportDoc.limit && exportDoc.limit > 0
      ? Math.min(exportDoc.limit, 10000)
      : DEFAULT_EXPORT_LIMIT;

  try {
    const builder = REPORT_BUILDERS[exportDoc.reportKey as ReportKey];
    const result = await builder({
      schoolId: schoolIdObj,
      startDate,
      endDate,
      periodId,
      filters,
      limit,
      rangeMode: definition.rangeMode,
    });

    const csv = buildCsv(result.headers, result.rows);
    const fileName =
      exportDoc.fileName ||
      `${exportDoc.reportKey.replace(/\./g, "-")}-${formatDate(startDate)}-to-${formatDate(endDate)}.${exportDoc.format}`;

    exportDoc.status = "completed";
    exportDoc.completedAt = new Date();
    exportDoc.downloadedAt = new Date();
    exportDoc.rowCount = result.rows.length;
    exportDoc.fileName = fileName;
    exportDoc.error = null;
    await exportDoc.save();

    await recordActivity({
      schoolId: schoolIdObj,
      userId,
      type: "report.generated",
      entityType: "ReportExport",
      entityId: exportDoc._id,
      description: `Generated ${definition.label}`,
      metadata: {
        reportKey: exportDoc.reportKey,
        reportLabel: definition.label,
        format: exportDoc.format,
        rowCount: result.rows.length,
        range: {
          startDate: exportDoc.range.startDate.toISOString(),
          endDate: exportDoc.range.endDate.toISOString(),
          periodId: exportDoc.range.periodId
            ? String(exportDoc.range.periodId)
            : null,
        },
      },
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    exportDoc.status = "failed";
    exportDoc.error =
      error instanceof Error ? error.message : "Failed to generate export";
    await exportDoc.save();

    return NextResponse.json(
      { error: exportDoc.error },
      { status: 500 }
    );
  }
}
