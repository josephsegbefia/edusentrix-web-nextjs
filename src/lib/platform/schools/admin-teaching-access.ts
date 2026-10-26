import "server-only";

import mongoose, { type ClientSession, type Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enforceSchoolLimit } from "@/lib/subscriptions/guards";
import { LIMIT_KEYS } from "@/lib/subscriptions/limit-keys";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { School } from "@/models/School";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";

export type AdministratorTeachingAccess = {
  userId: string;
  name: string | null;
  email: string | null;
  membershipStatus: IUserMembership["status"];
  schoolAdministrator: true;
  teachingAccessEnabled: boolean;
  teacherRoleAssigned: boolean;
  teacherProfileId: string | null;
  teacherProfileStatus: string | null;
  activeAssignmentCount: number;
};

export type AdminTeachingAccessFailureCode =
  | "INVALID_ID"
  | "SCHOOL_NOT_FOUND"
  | "ADMIN_MEMBERSHIP_NOT_FOUND"
  | "ADMIN_MEMBERSHIP_INACTIVE"
  | "TEACHER_PROFILE_NOT_ACTIVE"
  | "TEACHER_LIMIT_REACHED"
  | "ACTIVE_ASSIGNMENTS"
  | "CONFLICT";

export type AdminTeachingAccessFailure = {
  ok: false;
  code: AdminTeachingAccessFailureCode;
  status: 400 | 403 | 404 | 409;
  error: string;
};

export type AdminTeachingAccessResult<T> =
  | { ok: true; data: T }
  | AdminTeachingAccessFailure;

export class AdminTeachingAccessError extends Error {
  constructor(
    public readonly code: AdminTeachingAccessFailureCode,
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
    this.name = "AdminTeachingAccessError";
  }
}

function objectId(value: string | Types.ObjectId, field: string): Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AdminTeachingAccessError("INVALID_ID", 400, `Invalid ${field}.`);
  }
  return new mongoose.Types.ObjectId(value);
}

function failure(error: unknown): AdminTeachingAccessFailure | null {
  if (!(error instanceof AdminTeachingAccessError)) return null;
  return {
    ok: false,
    code: error.code,
    status: error.status,
    error: error.message,
  };
}

function displayName(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return (
    user.name?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    null
  );
}

async function loadAdministratorState(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  session?: ClientSession;
}): Promise<AdministratorTeachingAccess | null> {
  const [membership, user, teacher] = await Promise.all([
    UserMembership.findOne({
      schoolId: input.schoolId,
      userId: input.userId,
      roles: "school_admin",
    })
      .select("roles status")
      .session(input.session || null)
      .lean<{ roles: string[]; status: IUserMembership["status"] } | null>(),
    // Membership is the tenant boundary; do not use deprecated User.schoolId
    // as a prerequisite for a valid school-scoped administrator.
    User.findById(input.userId)
      .select("name firstName lastName email")
      .session(input.session || null)
      .lean<{
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
      } | null>(),
    Teacher.findOne({ schoolId: input.schoolId, userId: input.userId })
      .select("_id status")
      .session(input.session || null)
      .lean<{ _id: Types.ObjectId; status: string } | null>(),
  ]);

  if (!membership || !user) return null;

  const activeAssignmentCount = teacher
    ? await TeacherAssignment.countDocuments({
        schoolId: input.schoolId,
        teacherId: teacher._id,
        status: "active",
      }).session(input.session || null)
    : 0;

  return {
    userId: String(input.userId),
    name: displayName(user),
    email: user.email || null,
    membershipStatus: membership.status,
    schoolAdministrator: true,
    teachingAccessEnabled:
      membership.roles.includes("teacher") && teacher?.status === "active",
    teacherRoleAssigned: membership.roles.includes("teacher"),
    teacherProfileId: teacher ? String(teacher._id) : null,
    teacherProfileStatus: teacher?.status || null,
    activeAssignmentCount,
  };
}

async function requireActiveAdministrator(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  session?: ClientSession;
}) {
  const membership = await UserMembership.findOne({
    schoolId: input.schoolId,
    userId: input.userId,
    roles: "school_admin",
  })
    .select("_id roles status")
    .session(input.session || null)
    .lean<{
      _id: Types.ObjectId;
      roles: string[];
      status: IUserMembership["status"];
    } | null>();

  if (!membership) {
    throw new AdminTeachingAccessError(
      "ADMIN_MEMBERSHIP_NOT_FOUND",
      404,
      "The selected user is not a school administrator in this school."
    );
  }
  if (membership.status !== "active") {
    throw new AdminTeachingAccessError(
      "ADMIN_MEMBERSHIP_INACTIVE",
      409,
      "Teaching access can only be changed for an active school administrator membership."
    );
  }
  return membership;
}

export async function listSchoolAdministrators(
  schoolIdInput: string
): Promise<AdminTeachingAccessResult<{ schoolId: string; administrators: AdministratorTeachingAccess[] }>> {
  try {
    const schoolId = objectId(schoolIdInput, "school id");
    await connectToDatabase();
    const school = await School.findById(schoolId).select("_id").lean();
    if (!school) {
      return {
        ok: false,
        code: "SCHOOL_NOT_FOUND",
        status: 404,
        error: "School not found.",
      };
    }

    const memberships = await UserMembership.find({
      schoolId,
      roles: "school_admin",
    })
      .select("userId")
      .sort({ createdAt: 1 })
      .lean<Array<{ userId: Types.ObjectId }>>();

    const administrators = (
      await Promise.all(
        memberships.map((membership) =>
          loadAdministratorState({ schoolId, userId: membership.userId })
        )
      )
    ).filter((row): row is AdministratorTeachingAccess => Boolean(row));

    return { ok: true, data: { schoolId: String(schoolId), administrators } };
  } catch (error) {
    return failure(error) || Promise.reject(error);
  }
}

export async function setAdministratorTeachingAccess(input: {
  schoolId: string;
  userId: string;
  actorUserId: Types.ObjectId;
  enabled: boolean;
}): Promise<AdminTeachingAccessResult<AdministratorTeachingAccess>> {
  let session: ClientSession | null = null;
  try {
    const schoolId = objectId(input.schoolId, "school id");
    const userId = objectId(input.userId, "administrator user id");
    await connectToDatabase();

    const school = await School.findById(schoolId).select("_id").lean();
    if (!school) {
      return {
        ok: false,
        code: "SCHOOL_NOT_FOUND",
        status: 404,
        error: "School not found.",
      };
    }

    await requireActiveAdministrator({ schoolId, userId });
    const existingTeacher = await Teacher.findOne({ schoolId, userId })
      .select("_id status")
      .lean<{ _id: Types.ObjectId; status: string } | null>();

    if (input.enabled && existingTeacher && existingTeacher.status !== "active") {
      return {
        ok: false,
        code: "TEACHER_PROFILE_NOT_ACTIVE",
        status: 409,
        error: "An existing teacher profile is not active. Reactivate it explicitly before enabling teaching access.",
      };
    }

    if (input.enabled && !existingTeacher) {
      const current = await Teacher.countDocuments({ schoolId, status: "active" });
      const limit = await enforceSchoolLimit({
        schoolId,
        limitKey: LIMIT_KEYS.maxTeachers,
        current,
        increment: 1,
      });
      if (!limit.allowed) {
        return {
          ok: false,
          code: "TEACHER_LIMIT_REACHED",
          status: limit.statusCode === 429 ? 409 : limit.statusCode,
          error: limit.reason,
        };
      }
    }

    const activeSession = await mongoose.startSession();
    session = activeSession;
    let result: AdministratorTeachingAccess | null = null;
    await activeSession.withTransaction(async () => {
      const membership = await requireActiveAdministrator({
        schoolId,
        userId,
        session: activeSession,
      });
      const teacher = await Teacher.findOne({ schoolId, userId })
        .select("_id status")
        .session(activeSession)
        .lean<{ _id: Types.ObjectId; status: string } | null>();

      if (input.enabled) {
        if (teacher && teacher.status !== "active") {
          throw new AdminTeachingAccessError(
            "TEACHER_PROFILE_NOT_ACTIVE",
            409,
            "An existing teacher profile is not active. Reactivate it explicitly before enabling teaching access."
          );
        }

        let teacherId = teacher?._id || null;
        if (!teacher) {
          const created = new Teacher({
            schoolId,
            userId,
            subjectIds: [],
            subjectOfferingIds: [],
            status: "active",
          });
          await created.save({ session: activeSession });
          teacherId = created._id;
        }

        await UserMembership.updateOne(
          { _id: membership._id, schoolId, userId, status: "active" },
          { $addToSet: { roles: "teacher" } },
          { session: activeSession }
        );

        await PlatformAuditLog.create(
          [
            {
              actorId: input.actorUserId,
              schoolId,
              action: "platform.school_admin.teaching_access_enabled",
              entityType: "UserMembership",
              entityId: membership._id,
              metadata: {
                targetUserId: String(userId),
                teacherId: teacherId ? String(teacherId) : null,
                changed: !membership.roles.includes("teacher") || !teacher,
              },
            },
          ],
          { session: activeSession }
        );
      } else {
        let activeAssignmentCount = 0;
        if (teacher) {
          activeAssignmentCount = await TeacherAssignment.countDocuments({
            schoolId,
            teacherId: teacher._id,
            status: "active",
          }).session(activeSession);
        }
        if (activeAssignmentCount > 0) {
          throw new AdminTeachingAccessError(
            "ACTIVE_ASSIGNMENTS",
            409,
            `Teaching access cannot be disabled while ${activeAssignmentCount} active teaching assignment${activeAssignmentCount === 1 ? "" : "s"} remain. Reassign them first.`
          );
        }

        await UserMembership.updateOne(
          { _id: membership._id, schoolId, userId, status: "active" },
          { $pull: { roles: "teacher" } },
          { session: activeSession }
        );

        await PlatformAuditLog.create(
          [
            {
              actorId: input.actorUserId,
              schoolId,
              action: "platform.school_admin.teaching_access_disabled",
              entityType: "UserMembership",
              entityId: membership._id,
              metadata: {
                targetUserId: String(userId),
                teacherId: teacher ? String(teacher._id) : null,
                changed: membership.roles.includes("teacher"),
                activeAssignmentCount,
              },
            },
          ],
          { session: activeSession }
        );
      }

      result = await loadAdministratorState({
        schoolId,
        userId,
        session: activeSession,
      });
    });

    if (!result) {
      return {
        ok: false,
        code: "CONFLICT",
        status: 409,
        error: "Administrator teaching access could not be resolved after the update.",
      };
    }
    return { ok: true, data: result };
  } catch (error) {
    return failure(error) || Promise.reject(error);
  } finally {
    await session?.endSession();
  }
}
