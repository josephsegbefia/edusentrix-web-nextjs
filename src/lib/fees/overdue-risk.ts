import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Guardian } from "@/models/Guardian";
import { Invoice } from "@/models/Invoice";
import { Student } from "@/models/Student";
import { User } from "@/models/User";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const OVERDUE_STATUSES = ["issued", "partially_paid", "overdue"] as const;

export type OverdueBucketKey = "0_7" | "8_14" | "15_30" | "30_plus";

export type OverdueBucketSummary = {
  label: string;
  invoiceCount: number;
  amountMinor: number;
  studentCount: number;
};

export type OverdueGuardianContact = {
  name: string;
  email: string | null;
  phone: string | null;
};

export type OverdueStudentRow = {
  studentId: string;
  studentName: string;
  admissionNo: string | null;
  classGroupName: string | null;
  totalOutstandingMinor: number;
  overdueInvoiceCount: number;
  oldestDaysOverdue: number;
  oldestDueDate: string | null;
  primaryGuardian: OverdueGuardianContact | null;
};

export type OverdueRiskSnapshot = {
  asOf: string;
  summary: {
    totalOutstandingMinor: number;
    overdueInvoiceCount: number;
    overdueStudentCount: number;
    buckets: Record<OverdueBucketKey, OverdueBucketSummary>;
  };
  topStudents: OverdueStudentRow[];
  rows: OverdueStudentRow[];
  totalRows: number;
  truncated: boolean;
};

type BuildOverdueRiskSnapshotParams = {
  schoolId: mongoose.Types.ObjectId;
  limit?: number;
  topLimit?: number;
};

type StudentAggregateRow = {
  _id: mongoose.Types.ObjectId;
  totalOutstandingMinor: number;
  overdueInvoiceCount: number;
  oldestDaysOverdue: number;
  oldestDueDate: Date | null;
};

type StudentFacetResult = {
  rows: StudentAggregateRow[];
  meta: Array<{ totalRows: number }>;
};

type BucketAggregateRow = {
  _id: OverdueBucketKey;
  invoiceCount: number;
  amountMinor: number;
  studentCount: number;
};

type SummaryFacetResult = {
  totals: Array<{ totalOutstandingMinor: number; overdueInvoiceCount: number }>;
  buckets: BucketAggregateRow[];
};

type StudentDoc = {
  _id: mongoose.Types.ObjectId;
  admissionNo?: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  classGroupId?: mongoose.Types.ObjectId | null;
};

type ClassGroupDoc = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
};

type GuardianDoc = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  isPrimary?: boolean;
  email?: string | null;
  phone?: string | null;
};

type UserDoc = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

function toSafeLimit(value: number | undefined, fallback: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

function buildName(parts: Array<string | null | undefined>, fallback = "Unknown") {
  const value = parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return value || fallback;
}

function buildGuardianName(user?: UserDoc | null, fallbackEmail?: string | null) {
  return buildName(
    [user?.firstName || null, user?.lastName || null, user?.name || null, fallbackEmail || null],
    "Guardian"
  );
}

function emptyBuckets(): Record<OverdueBucketKey, OverdueBucketSummary> {
  return {
    "0_7": { label: "0-7 days", invoiceCount: 0, amountMinor: 0, studentCount: 0 },
    "8_14": { label: "8-14 days", invoiceCount: 0, amountMinor: 0, studentCount: 0 },
    "15_30": { label: "15-30 days", invoiceCount: 0, amountMinor: 0, studentCount: 0 },
    "30_plus": { label: "30+ days", invoiceCount: 0, amountMinor: 0, studentCount: 0 },
  };
}

function resolveBucketRows(rows: BucketAggregateRow[]) {
  const buckets = emptyBuckets();
  for (const row of rows) {
    if (!(row._id in buckets)) continue;
    buckets[row._id] = {
      ...buckets[row._id],
      invoiceCount: row.invoiceCount || 0,
      amountMinor: row.amountMinor || 0,
      studentCount: row.studentCount || 0,
    };
  }
  return buckets;
}

function buildInvoiceMatch(schoolId: mongoose.Types.ObjectId, now: Date) {
  return {
    schoolId,
    status: { $in: OVERDUE_STATUSES },
    totalOutstandingMinor: { $gt: 0 },
    dueDate: { $lt: now },
  };
}

function baseOverdueProjection(now: Date) {
  return {
    studentId: 1,
    totalOutstandingMinor: 1,
    dueDate: 1,
    daysOverdue: {
      $max: [
        0,
        {
          $toInt: {
            $floor: {
              $divide: [{ $subtract: [now, "$dueDate"] }, MS_PER_DAY],
            },
          },
        },
      ],
    },
  };
}

function bucketProjection() {
  return {
    $switch: {
      branches: [
        { case: { $lte: ["$daysOverdue", 7] }, then: "0_7" },
        { case: { $lte: ["$daysOverdue", 14] }, then: "8_14" },
        { case: { $lte: ["$daysOverdue", 30] }, then: "15_30" },
      ],
      default: "30_plus",
    },
  };
}

export async function buildOverdueRiskSnapshot(
  params: BuildOverdueRiskSnapshotParams
): Promise<OverdueRiskSnapshot> {
  const now = new Date();
  const rowLimit = toSafeLimit(params.limit, 80, 600);
  const topLimit = toSafeLimit(params.topLimit, 5, 20);
  const detailLimit = Math.max(rowLimit, topLimit);

  const invoiceMatch = buildInvoiceMatch(params.schoolId, now);

  const [studentFacetRaw, summaryFacetRaw] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $project: baseOverdueProjection(now) },
      {
        $group: {
          _id: "$studentId",
          totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
          overdueInvoiceCount: { $sum: 1 },
          oldestDaysOverdue: { $max: "$daysOverdue" },
          oldestDueDate: { $min: "$dueDate" },
        },
      },
      { $sort: { totalOutstandingMinor: -1 } },
      {
        $facet: {
          rows: [{ $limit: detailLimit }],
          meta: [{ $count: "totalRows" }],
        },
      },
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $project: { ...baseOverdueProjection(now), bucket: bucketProjection() } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalOutstandingMinor: { $sum: "$totalOutstandingMinor" },
                overdueInvoiceCount: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                totalOutstandingMinor: 1,
                overdueInvoiceCount: 1,
              },
            },
          ],
          buckets: [
            {
              $group: {
                _id: "$bucket",
                invoiceCount: { $sum: 1 },
                amountMinor: { $sum: "$totalOutstandingMinor" },
                students: { $addToSet: "$studentId" },
              },
            },
            {
              $project: {
                _id: 1,
                invoiceCount: 1,
                amountMinor: 1,
                studentCount: { $size: "$students" },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const studentFacet = (studentFacetRaw[0] || {
    rows: [],
    meta: [],
  }) as StudentFacetResult;
  const summaryFacet = (summaryFacetRaw[0] || {
    totals: [],
    buckets: [],
  }) as SummaryFacetResult;

  const aggregateRows = studentFacet.rows || [];
  const totalRows = studentFacet.meta?.[0]?.totalRows || 0;

  if (aggregateRows.length === 0) {
    return {
      asOf: now.toISOString(),
      summary: {
        totalOutstandingMinor: 0,
        overdueInvoiceCount: 0,
        overdueStudentCount: 0,
        buckets: emptyBuckets(),
      },
      topStudents: [],
      rows: [],
      totalRows: 0,
      truncated: false,
    };
  }

  const studentIds = aggregateRows.map((row) => row._id);
  const students = (await Student.find({
    _id: { $in: studentIds },
    schoolId: params.schoolId,
  })
    .select("firstName middleName lastName admissionNo classGroupId")
    .lean()) as unknown as StudentDoc[];

  const classGroupIds = Array.from(
    new Set(
      students
        .map((student) => student.classGroupId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
        .map((id) => String(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const [classGroups, guardians] = await Promise.all([
    classGroupIds.length > 0
      ? ((await ClassGroup.find({ _id: { $in: classGroupIds } })
          .select("name")
          .lean()) as unknown as ClassGroupDoc[])
      : ([] as ClassGroupDoc[]),
    ((await Guardian.find({ studentId: { $in: studentIds } })
      .select("studentId userId isPrimary email phone")
      .lean()) as unknown as GuardianDoc[]),
  ]);

  const userIds = Array.from(
    new Set(
      guardians
        .map((guardian) => guardian.userId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
        .map((id) => String(id))
    )
  ).map((id) => new mongoose.Types.ObjectId(id));

  const users = userIds.length
    ? ((await User.find({ _id: { $in: userIds } })
        .select("firstName lastName name email phone")
        .lean()) as unknown as UserDoc[])
    : ([] as UserDoc[]);

  const studentMap = new Map(
    students.map((student) => [
      String(student._id),
      {
        studentName: buildName([student.firstName, student.middleName, student.lastName]),
        admissionNo: student.admissionNo || null,
        classGroupId: student.classGroupId ? String(student.classGroupId) : null,
      },
    ])
  );
  const classGroupMap = new Map(
    classGroups.map((group) => [String(group._id), group.name || null])
  );
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const guardianByStudent = new Map<string, OverdueGuardianContact | null>();
  for (const guardian of guardians) {
    const studentId = String(guardian.studentId);
    const user = guardian.userId ? userMap.get(String(guardian.userId)) : null;
    const contact: OverdueGuardianContact = {
      name: buildGuardianName(user || null, guardian.email || null),
      email: user?.email || guardian.email || null,
      phone: user?.phone || guardian.phone || null,
    };

    if (!guardianByStudent.has(studentId) || guardian.isPrimary) {
      guardianByStudent.set(studentId, contact);
    }
  }

  const rows: OverdueStudentRow[] = aggregateRows
    .map((row) => {
      const student = studentMap.get(String(row._id));
      if (!student) return null;

      return {
        studentId: String(row._id),
        studentName: student.studentName,
        admissionNo: student.admissionNo,
        classGroupName: student.classGroupId
          ? classGroupMap.get(student.classGroupId) || null
          : null,
        totalOutstandingMinor: row.totalOutstandingMinor || 0,
        overdueInvoiceCount: row.overdueInvoiceCount || 0,
        oldestDaysOverdue: row.oldestDaysOverdue || 0,
        oldestDueDate: row.oldestDueDate
          ? new Date(row.oldestDueDate).toISOString()
          : null,
        primaryGuardian: guardianByStudent.get(String(row._id)) || null,
      };
    })
    .filter((item): item is OverdueStudentRow => Boolean(item));

  const totals = summaryFacet.totals?.[0] || {
    totalOutstandingMinor: 0,
    overdueInvoiceCount: 0,
  };
  const buckets = resolveBucketRows(summaryFacet.buckets || []);

  return {
    asOf: now.toISOString(),
    summary: {
      totalOutstandingMinor: totals.totalOutstandingMinor || 0,
      overdueInvoiceCount: totals.overdueInvoiceCount || 0,
      overdueStudentCount: totalRows,
      buckets,
    },
    topStudents: rows.slice(0, topLimit),
    rows: rows.slice(0, rowLimit),
    totalRows,
    truncated: totalRows > rowLimit,
  };
}
