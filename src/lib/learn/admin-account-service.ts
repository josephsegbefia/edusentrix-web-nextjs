import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  generateTemporaryLearnPassword,
  generateUniqueLearnUsername,
  hashLearnPassword,
} from "@/lib/learn/account-credentials";
import { getSchoolLearnEligibility } from "@/lib/learn/eligibility";
import { AuditEvent } from "@/models/AuditEvent";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Notification } from "@/models/Notification";
import { Student } from "@/models/Student";

type CreateLearnAccountInput = {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  actorUserId: Types.ObjectId;
};

type StudentForAccount = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  status: "active" | "inactive" | "withdrawn" | "graduated";
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
};

type GuardianForDelivery = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  isPrimary?: boolean;
};

type AccountForCredentialAction = {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  username: string;
  status: string;
};

function fullName(student: Pick<StudentForAccount, "firstName" | "middleName" | "lastName">) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

async function auditLearnAccountCreated(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  guardianCount: number;
}) {
  await AuditEvent.create({
    scopeType: "school",
    scopeId: input.schoolId,
    domain: "identity",
    tier: 1,
    actionCode: "learn.account.created",
    result: "succeeded",
    occurredAt: new Date(),
    actorType: "user",
    actorId: input.actorUserId,
    targetEntityType: "LearnStudentAccount",
    targetEntityId: input.accountId,
    secondaryEntityType: "Student",
    secondaryEntityId: input.studentId,
    metadata: { guardianCount: input.guardianCount },
    sensitivity: "high",
    redactionMode: "hidden",
    retentionClass: "identity_and_permissions",
  });
}

async function auditCredentialAction(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId: Types.ObjectId;
  actionCode: "learn.account.password_reset" | "learn.account.credentials_resent";
  guardianCount: number;
}) {
  await AuditEvent.create({
    scopeType: "school",
    scopeId: input.schoolId,
    domain: "identity",
    tier: 1,
    actionCode: input.actionCode,
    result: "succeeded",
    occurredAt: new Date(),
    actorType: "user",
    actorId: input.actorUserId,
    targetEntityType: "LearnStudentAccount",
    targetEntityId: input.accountId,
    secondaryEntityType: "Student",
    secondaryEntityId: input.studentId,
    metadata: { guardianCount: input.guardianCount },
    sensitivity: "high",
    redactionMode: "hidden",
    retentionClass: "identity_and_permissions",
  });
}

export async function createLearnAccountForStudent(input: CreateLearnAccountInput) {
  await connectToDatabase();

  const eligibility = await getSchoolLearnEligibility(input.schoolId);
  if (!eligibility.eligible) {
    return {
      ok: false as const,
      status: 403,
      error: eligibility.reason || "This school is not eligible for EduSentrix Learn.",
    };
  }

  const student = await Student.findOne({
    _id: input.studentId,
    schoolId: input.schoolId,
  })
    .select("_id schoolId firstName middleName lastName status gradeId classGroupId")
    .lean<StudentForAccount | null>();

  if (!student) {
    return { ok: false as const, status: 404, error: "Student not found." };
  }

  if (student.status !== "active") {
    return {
      ok: false as const,
      status: 400,
      error: "Only active students can receive Learn accounts.",
    };
  }

  if (!student.gradeId || !student.classGroupId) {
    return {
      ok: false as const,
      status: 400,
      error: "Student must have a grade and class group before Learn account creation.",
    };
  }

  const [gradeExists, classGroupExists, existingAccount, guardians] =
    await Promise.all([
      Grade.exists({ _id: student.gradeId, schoolId: input.schoolId }),
      ClassGroup.exists({
        _id: student.classGroupId,
        schoolId: input.schoolId,
      }),
      LearnStudentAccount.findOne({
        schoolId: input.schoolId,
        studentId: input.studentId,
      })
        .select("_id status username")
        .lean<{ _id: Types.ObjectId; status: string; username: string } | null>(),
      Guardian.find({ studentId: input.studentId })
        .select("_id userId email isPrimary")
        .lean<GuardianForDelivery[]>(),
    ]);

  if (!gradeExists || !classGroupExists) {
    return {
      ok: false as const,
      status: 400,
      error: "Student grade or class group does not belong to this school.",
    };
  }

  if (existingAccount) {
    return {
      ok: false as const,
      status: 409,
      error: "This student already has a Learn account.",
      account: {
        id: String(existingAccount._id),
        username: existingAccount.username,
        status: existingAccount.status,
      },
    };
  }

  const username = await generateUniqueLearnUsername({
    firstName: student.firstName,
    lastName: student.lastName,
    fallbackId: student._id,
  });
  const temporaryPassword = generateTemporaryLearnPassword();
  const passwordHash = await hashLearnPassword(temporaryPassword);

  const account = await LearnStudentAccount.create({
    schoolId: input.schoolId,
    studentId: input.studentId,
    username,
    passwordHash,
    status: "pending_first_login",
    mustChangePassword: true,
    createdBy: input.actorUserId,
    credentialsDeliveredAt: guardians.length ? new Date() : null,
    credentialsDeliveredToUserId:
      guardians.find((guardian) => guardian.isPrimary)?.userId ||
      guardians[0]?.userId ||
      null,
  });

  if (guardians.length) {
    await Notification.insertMany(
      guardians.map((guardian) => ({
        schoolId: input.schoolId,
        userId: guardian.userId,
        type: "system",
        title: "EduSentrix Learn account created",
        body: `${fullName(student)} now has an EduSentrix Learn account. Open Learn to view credential status and access details.`,
        priority: "high",
        isRead: false,
        wardId: input.studentId,
        entityType: "LearnStudentAccount",
        entityId: account._id,
        actionUrl: `/parent/learn/wards/${String(input.studentId)}`,
        metadata: {
          username,
          credentialDelivery: "admin_one_time_display",
        },
      }))
    );
  }

  await auditLearnAccountCreated({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    studentId: input.studentId,
    accountId: account._id,
    guardianCount: guardians.length,
  });

  return {
    ok: true as const,
    data: {
      accountId: String(account._id),
      studentId: String(input.studentId),
      studentName: fullName(student),
      username,
      temporaryPassword,
      mustChangePassword: true,
      guardiansNotified: guardians.length,
    },
  };
}

export async function resetLearnAccountPassword(input: {
  schoolId: Types.ObjectId;
  accountId: Types.ObjectId;
  actorUserId: Types.ObjectId;
}) {
  await connectToDatabase();

  const account = await LearnStudentAccount.findOne({
    _id: input.accountId,
    schoolId: input.schoolId,
  })
    .select("_id schoolId studentId username status")
    .lean<AccountForCredentialAction | null>();
  if (!account) {
    return { ok: false as const, status: 404, error: "Learn account not found." };
  }
  if (account.status === "disabled") {
    return {
      ok: false as const,
      status: 409,
      error: "Disabled Learn accounts must be enabled before password reset.",
    };
  }

  const [student, guardians] = await Promise.all([
    Student.findOne({ _id: account.studentId, schoolId: input.schoolId })
      .select("_id firstName middleName lastName")
      .lean<StudentForAccount | null>(),
    Guardian.find({ studentId: account.studentId })
      .select("_id userId email isPrimary")
      .lean<GuardianForDelivery[]>(),
  ]);

  if (!student) {
    return { ok: false as const, status: 404, error: "Student not found." };
  }

  const temporaryPassword = generateTemporaryLearnPassword();
  const passwordHash = await hashLearnPassword(temporaryPassword);
  const deliveredTo =
    guardians.find((guardian) => guardian.isPrimary)?.userId ||
    guardians[0]?.userId ||
    null;

  await LearnStudentAccount.updateOne(
    { _id: account._id, schoolId: input.schoolId },
    {
      $set: {
        passwordHash,
        status: "pending_first_login",
        mustChangePassword: true,
        credentialsDeliveredAt: guardians.length ? new Date() : null,
        credentialsDeliveredToUserId: deliveredTo,
      },
    }
  );

  if (guardians.length) {
    await Notification.insertMany(
      guardians.map((guardian) => ({
        schoolId: input.schoolId,
        userId: guardian.userId,
        type: "system",
        title: "EduSentrix Learn password reset",
        body: `${fullName(student)}'s EduSentrix Learn password has been reset. Open Learn to view credential status and access details.`,
        priority: "high",
        isRead: false,
        wardId: account.studentId,
        entityType: "LearnStudentAccount",
        entityId: account._id,
        actionUrl: `/parent/learn/wards/${String(account.studentId)}`,
        metadata: {
          username: account.username,
          credentialDelivery: "admin_one_time_display",
        },
      }))
    );
  }

  await auditCredentialAction({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    studentId: account.studentId,
    accountId: account._id,
    actionCode: "learn.account.password_reset",
    guardianCount: guardians.length,
  });

  return {
    ok: true as const,
    data: {
      accountId: String(account._id),
      studentId: String(account.studentId),
      studentName: fullName(student),
      username: account.username,
      temporaryPassword,
      mustChangePassword: true,
      guardiansNotified: guardians.length,
    },
  };
}

export async function resendLearnAccountCredentials(input: {
  schoolId: Types.ObjectId;
  accountId: Types.ObjectId;
  actorUserId: Types.ObjectId;
}) {
  await connectToDatabase();

  const account = await LearnStudentAccount.findOne({
    _id: input.accountId,
    schoolId: input.schoolId,
  })
    .select("_id schoolId studentId username status")
    .lean<AccountForCredentialAction | null>();
  if (!account) {
    return { ok: false as const, status: 404, error: "Learn account not found." };
  }

  const [student, guardians] = await Promise.all([
    Student.findOne({ _id: account.studentId, schoolId: input.schoolId })
      .select("_id firstName middleName lastName")
      .lean<StudentForAccount | null>(),
    Guardian.find({ studentId: account.studentId })
      .select("_id userId email isPrimary")
      .lean<GuardianForDelivery[]>(),
  ]);

  if (!student) {
    return { ok: false as const, status: 404, error: "Student not found." };
  }

  const deliveredTo =
    guardians.find((guardian) => guardian.isPrimary)?.userId ||
    guardians[0]?.userId ||
    null;

  await LearnStudentAccount.updateOne(
    { _id: account._id, schoolId: input.schoolId },
    {
      $set: {
        credentialsDeliveredAt: guardians.length ? new Date() : null,
        credentialsDeliveredToUserId: deliveredTo,
      },
    }
  );

  if (guardians.length) {
    await Notification.insertMany(
      guardians.map((guardian) => ({
        schoolId: input.schoolId,
        userId: guardian.userId,
        type: "system",
        title: "EduSentrix Learn credentials available",
        body: `${fullName(student)}'s EduSentrix Learn username is available in Learn credentials. Request a reset if the temporary password has been lost.`,
        priority: "normal",
        isRead: false,
        wardId: account.studentId,
        entityType: "LearnStudentAccount",
        entityId: account._id,
        actionUrl: "/parent/learn/credentials",
        metadata: {
          username: account.username,
          credentialDelivery: "status_only",
        },
      }))
    );
  }

  await auditCredentialAction({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    studentId: account.studentId,
    accountId: account._id,
    actionCode: "learn.account.credentials_resent",
    guardianCount: guardians.length,
  });

  return {
    ok: true as const,
    data: {
      accountId: String(account._id),
      studentId: String(account.studentId),
      studentName: fullName(student),
      username: account.username,
      guardiansNotified: guardians.length,
    },
  };
}
