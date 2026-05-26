import { Types } from "mongoose";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { getOrCreateLearnPlatformSettings } from "@/lib/learn/platform-settings";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { LearnAccess } from "@/models/LearnAccess";
import { LearnActivityEvent, type LearnActivityEventType } from "@/models/LearnActivityEvent";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";

type GuardianLink = {
  studentId: Types.ObjectId;
  relationship?: string | null;
  isPrimary?: boolean | null;
};

type StudentRow = {
  _id: Types.ObjectId;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  admissionNo?: string | null;
  photoUrl?: string | null;
  status?: string | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

type NamedRow = {
  _id: Types.ObjectId;
  name?: string | null;
};

type ClassGroupRow = NamedRow & {
  gradeId?: Types.ObjectId | null;
};

type AccountRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  username: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt?: Date | null;
  credentialsDeliveredAt?: Date | null;
};

type AccessRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  source: string;
  status: string;
  startsAt: Date;
  expiresAt: Date;
};

type PaymentRow = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  amountMinor: number;
  currency: "GHS";
  status: string;
  createdAt: Date;
};

type ActivityRow = {
  _id: {
    studentId: Types.ObjectId;
    eventType: LearnActivityEventType;
  };
  count: number;
};

export type ParentLearnWardSummary = {
  studentId: string;
  name: string;
  admissionNo: string | null;
  photoUrl: string | null;
  status: string | null;
  relationship: string;
  isPrimary: boolean;
  gradeName: string | null;
  classGroupName: string | null;
  eligible: boolean;
  eligibilityReason: string | null;
  account: {
    id: string;
    username: string;
    status: string;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    credentialsDeliveredAt: string | null;
  } | null;
  access: {
    id: string;
    source: string;
    status: string;
    startsAt: string | null;
    expiresAt: string | null;
  } | null;
  latestPayment: {
    id: string;
    amountMinor: number;
    currency: "GHS";
    status: string;
    createdAt: string | null;
  } | null;
  activity: {
    total: number;
    questsCompleted: number;
    leoTutorMessages: number;
    flashcardsReviewed: number;
    revisionSessions: number;
  };
};

export type ParentLearnOverview = {
  pricePerStudentPerTermMinor: number;
  currency: "GHS";
  schoolEligibility: Awaited<ReturnType<typeof getSchoolLearnEligibility>>;
  wards: ParentLearnWardSummary[];
};

function fullName(student: StudentRow) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function iso(date?: Date | null) {
  return date?.toISOString?.() || null;
}

function activityBucket(rows: ActivityRow[], studentId: string) {
  const counts = new Map<LearnActivityEventType, number>();
  for (const row of rows) {
    if (String(row._id.studentId) !== studentId) continue;
    counts.set(row._id.eventType, row.count);
  }

  const questsCompleted = counts.get("quest_completed") || 0;
  const leoTutorMessages = counts.get("leo_tutor_message") || 0;
  const flashcardsReviewed = counts.get("flashcard_reviewed") || 0;
  const revisionSessions = counts.get("revision_session") || 0;

  return {
    total: Array.from(counts.values()).reduce((sum, count) => sum + count, 0),
    questsCompleted,
    leoTutorMessages,
    flashcardsReviewed,
    revisionSessions,
  };
}

export async function getParentLearnOverview(
  schoolId: Types.ObjectId,
  parentUserId: Types.ObjectId,
  onlyStudentId?: Types.ObjectId
): Promise<ParentLearnOverview> {
  const [settings, schoolEligibility, guardians] = await Promise.all([
    getOrCreateLearnPlatformSettings(),
    getSchoolLearnEligibility(schoolId),
    Guardian.find({
      userId: parentUserId,
      ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
    })
      .select("studentId relationship isPrimary")
      .lean<GuardianLink[]>(),
  ]);

  const studentIds = guardians.map((guardian) => guardian.studentId);
  if (!studentIds.length) {
    return {
      pricePerStudentPerTermMinor: settings.pricePerStudentPerTermMinor,
      currency: settings.currency,
      schoolEligibility,
      wards: [],
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [students, accounts, activeAccesses, latestPayments, activityRows] =
    await Promise.all([
      Student.find({ _id: { $in: studentIds }, schoolId })
        .select("_id firstName middleName lastName admissionNo photoUrl status gradeId classGroupId")
        .lean<StudentRow[]>(),
      LearnStudentAccount.find({ schoolId, studentId: { $in: studentIds } })
        .select("_id studentId username status mustChangePassword lastLoginAt credentialsDeliveredAt")
        .lean<AccountRow[]>(),
      LearnAccess.find({
        schoolId,
        studentId: { $in: studentIds },
        status: "active",
        expiresAt: { $gt: now },
      })
        .sort({ expiresAt: -1 })
        .select("_id studentId source status startsAt expiresAt")
        .lean<AccessRow[]>(),
      LearnPaymentIntent.find({ parentUserId, schoolId, studentId: { $in: studentIds } })
        .sort({ createdAt: -1 })
        .select("_id studentId amountMinor currency status createdAt")
        .lean<PaymentRow[]>(),
      LearnActivityEvent.aggregate<ActivityRow>([
        {
          $match: {
            schoolId,
            studentId: { $in: studentIds },
            occurredAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: { studentId: "$studentId", eventType: "$eventType" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const gradeIds = Array.from(
    new Set(students.map((student) => String(student.gradeId || "")).filter(Boolean))
  );
  const classGroupIds = Array.from(
    new Set(students.map((student) => String(student.classGroupId || "")).filter(Boolean))
  );
  const [grades, classGroups] = await Promise.all([
    Grade.find({ _id: { $in: gradeIds }, schoolId }).select("_id name").lean<NamedRow[]>(),
    ClassGroup.find({ _id: { $in: classGroupIds }, schoolId })
      .select("_id name gradeId")
      .lean<ClassGroupRow[]>(),
  ]);

  const guardianMap = new Map(
    guardians.map((guardian) => [String(guardian.studentId), guardian])
  );
  const gradeMap = new Map(grades.map((grade) => [String(grade._id), grade.name || null]));
  const classGroupMap = new Map(
    classGroups.map((classGroup) => [String(classGroup._id), classGroup.name || null])
  );
  const accountMap = new Map(accounts.map((account) => [String(account.studentId), account]));
  const accessMap = new Map<string, AccessRow>();
  for (const access of activeAccesses) {
    const key = String(access.studentId);
    if (!accessMap.has(key)) accessMap.set(key, access);
  }
  const paymentMap = new Map<string, PaymentRow>();
  for (const payment of latestPayments) {
    const key = String(payment.studentId);
    if (!paymentMap.has(key)) paymentMap.set(key, payment);
  }

  const wards = students.map<ParentLearnWardSummary>((student) => {
    const studentId = String(student._id);
    const guardian = guardianMap.get(studentId);
    const account = accountMap.get(studentId);
    const access = accessMap.get(studentId);
    const latestPayment = paymentMap.get(studentId);
    const isActiveStudent = student.status === "active";
    const hasPlacement = Boolean(student.gradeId && student.classGroupId);
    const eligible = Boolean(schoolEligibility.eligible && isActiveStudent && hasPlacement);

    return {
      studentId,
      name: fullName(student) || "Student",
      admissionNo: student.admissionNo || null,
      photoUrl: student.photoUrl || null,
      status: student.status || null,
      relationship: guardian?.relationship || "guardian",
      isPrimary: Boolean(guardian?.isPrimary),
      gradeName: student.gradeId ? gradeMap.get(String(student.gradeId)) || null : null,
      classGroupName: student.classGroupId
        ? classGroupMap.get(String(student.classGroupId)) || null
        : null,
      eligible,
      eligibilityReason: eligible
        ? null
        : schoolEligibility.reason ||
          (!isActiveStudent ? "Student is not active." : "Student needs a grade and class group."),
      account: account
        ? {
            id: String(account._id),
            username: account.username,
            status: account.status,
            mustChangePassword: account.mustChangePassword,
            lastLoginAt: iso(account.lastLoginAt),
            credentialsDeliveredAt: iso(account.credentialsDeliveredAt),
          }
        : null,
      access: access
        ? {
            id: String(access._id),
            source: access.source,
            status: access.status,
            startsAt: iso(access.startsAt),
            expiresAt: iso(access.expiresAt),
          }
        : null,
      latestPayment: latestPayment
        ? {
            id: String(latestPayment._id),
            amountMinor: latestPayment.amountMinor,
            currency: latestPayment.currency,
            status: latestPayment.status,
            createdAt: iso(latestPayment.createdAt),
          }
        : null,
      activity: activityBucket(activityRows, studentId),
    };
  });

  return {
    pricePerStudentPerTermMinor: settings.pricePerStudentPerTermMinor,
    currency: settings.currency,
    schoolEligibility,
    wards,
  };
}
