/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/admissions/provisioning-service.ts
// Idempotent provisioning of an accepted admissions application:
//   1. Resolve a destination ClassGroup (use decision target, or pick the
//      least-loaded active group for the target grade if none was set).
//   2. Create a `Student` row linked to the application.
//   3. Upsert a `User` for the guardian, send Clerk invite if needed.
//   4. Ensure `UserMembership` has the `parent` role for that school.
//   5. Create the `Guardian` join row (if it doesn't already exist).
//   6. Stamp `application.provisioned` and bump status to "accepted".
//   7. Append AdmissionEvent ("application.provisioned").

import "server-only";
import mongoose, { Types } from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";

import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { ClassGroup } from "@/models/ClassGroup";
import { School } from "@/models/School";
import { Invitation } from "@/models/Invitation";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";

export class ProvisioningServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProvisioningServiceError";
    this.status = status;
  }
}

export type ProvisionApplicationInput = {
  applicationId: Types.ObjectId | string;
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  actorRole: "school_admin" | "admissions_officer";
  actorLabel: string;
  /** Optional override; otherwise uses application.decision.targetClassGroupId
   *  or auto-picks least-loaded active class group for the target grade. */
  targetClassGroupId?: string | null;
  /** Optional override for grade; otherwise uses decision.targetGradeId. */
  targetGradeId?: string | null;
  /** When true, send the parent a Clerk invite if they don't have one yet. */
  sendParentInvite?: boolean;
};

export type ProvisionApplicationResult = {
  applicationId: string;
  studentId: string;
  guardianId: string;
  parentUserId: string;
  classGroupId: string;
  gradeId: string;
  invitedParent: boolean;
  alreadyProvisioned: boolean;
};

const RELATIONSHIP_VALUES = new Set([
  "mother",
  "father",
  "guardian",
  "step_mother",
  "step_father",
  "grandmother",
  "grandfather",
  "aunt",
  "uncle",
  "other",
]);

function normalizeRelationship(raw: string | null | undefined) {
  if (!raw) return "guardian" as const;
  const v = String(raw).toLowerCase().trim().replace(/\s+/g, "_");
  if (RELATIONSHIP_VALUES.has(v)) return v as any;
  return "guardian" as const;
}

async function pickLeastLoadedClassGroup(args: {
  schoolId: Types.ObjectId;
  gradeId: Types.ObjectId;
}): Promise<{ id: Types.ObjectId; capacityFull: boolean } | null> {
  const groups = await ClassGroup.find({
    schoolId: args.schoolId,
    gradeId: args.gradeId,
    isActive: true,
  })
    .select({ _id: 1, capacity: 1 })
    .lean<Array<{ _id: Types.ObjectId; capacity?: number | null }>>();
  if (!groups.length) return null;

  const counts = await Student.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        schoolId: args.schoolId,
        classGroupId: { $in: groups.map((g) => g._id) },
        status: "active",
      },
    },
    { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  let best: {
    id: Types.ObjectId;
    headroom: number;
    count: number;
    capacityFull: boolean;
  } | null = null;

  for (const g of groups) {
    const count = countMap.get(String(g._id)) ?? 0;
    const cap = g.capacity ?? null;
    const capacityFull = cap != null && count >= cap;
    const headroom = cap == null ? Number.POSITIVE_INFINITY : cap - count;
    const candidate = {
      id: g._id,
      headroom,
      count,
      capacityFull,
    };
    if (
      !best ||
      candidate.headroom > best.headroom ||
      (candidate.headroom === best.headroom && candidate.count < best.count)
    ) {
      best = candidate;
    }
  }
  if (!best) return null;
  return { id: best.id, capacityFull: best.capacityFull };
}

async function inviteParentIfNeeded(args: {
  emailLower: string;
  schoolId: Types.ObjectId;
  schoolName: string;
  guardianFirstName: string;
  guardianLastName: string;
  applicationRef: string;
  invitedBy: Types.ObjectId;
}): Promise<boolean> {
  const existingPendingInvite = await Invitation.findOne({
    schoolId: args.schoolId,
    email: args.emailLower,
    role: "parent",
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (existingPendingInvite) return false;

  const redirectUrl = getInvitationRedirectUrl();
  let clerkInvitationId: string | undefined;
  let invitationStatus: "pending" | "failed" = "pending";
  let acceptUrl: string | null = null;

  try {
    const clerk = await clerkClient();
    const clerkInvitation = await clerk.invitations.createInvitation({
      emailAddress: args.emailLower,
      redirectUrl,
      notify: false,
      publicMetadata: {
        role: "parent",
        schoolId: String(args.schoolId),
      },
      ignoreExisting: true,
    });
    clerkInvitationId = clerkInvitation.id;
    acceptUrl = getInvitationAcceptUrl(clerkInvitation, redirectUrl);

    const rendered = renderTemplate("USER_INVITE", {
      name: `${args.guardianFirstName} ${args.guardianLastName}`.trim() || "Parent",
      role: "parent",
      schoolName: args.schoolName,
      setupLink: acceptUrl,
    });

    await sendTrackedBrevoEmail({
      to: args.emailLower,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      templateKey: "USER_INVITE",
      schoolId: String(args.schoolId),
      schoolName: args.schoolName,
      actorId: String(args.invitedBy),
      actorRole: "school_admin",
      relatedEntityType: "invitation",
    });
  } catch (err) {
    console.error("Admissions parent invite failed:", err);
    invitationStatus = "failed";
  }

  try {
    await Invitation.create({
      email: args.emailLower,
      role: "parent",
      schoolId: args.schoolId,
      status: invitationStatus,
      clerkInvitationId,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: args.invitedBy,
      metadata: {
        firstName: args.guardianFirstName,
        lastName: args.guardianLastName,
        admissionsApplicationRef: args.applicationRef,
      },
    });
  } catch (recordErr) {
    console.error("Failed to record admissions parent invitation:", recordErr);
  }

  return invitationStatus === "pending";
}

export async function provisionApplication(
  input: ProvisionApplicationInput
): Promise<ProvisionApplicationResult> {
  await connectToDatabase();

  const application = await AdmissionApplication.findOne({
    _id: input.applicationId,
    schoolId: input.schoolId,
  });
  if (!application) {
    throw new ProvisioningServiceError("Application not found", 404);
  }

  if (application.provisioned) {
    return {
      applicationId: String(application._id),
      studentId: String(application.provisioned.studentId),
      guardianId: String(application.provisioned.guardianId),
      parentUserId: String(application.provisioned.parentUserId),
      classGroupId: "",
      gradeId: "",
      invitedParent: false,
      alreadyProvisioned: true,
    };
  }

  if (application.status !== "accepted" || !application.decision) {
    throw new ProvisioningServiceError(
      "Only accepted applications can be provisioned. Record an Accept decision first.",
      409
    );
  }

  const decisionGradeIdRaw =
    input.targetGradeId ??
    (application.decision.targetGradeId
      ? String(application.decision.targetGradeId)
      : null);
  if (!decisionGradeIdRaw || !mongoose.Types.ObjectId.isValid(decisionGradeIdRaw)) {
    throw new ProvisioningServiceError(
      "This application's decision is missing a target grade."
    );
  }
  const targetGradeId = new Types.ObjectId(decisionGradeIdRaw);

  // Resolve class group: explicit override > decision selection > least-loaded.
  const explicitClassGroupId =
    input.targetClassGroupId ??
    (application.decision.targetClassGroupId
      ? String(application.decision.targetClassGroupId)
      : null);

  let targetClassGroupId: Types.ObjectId | null = null;
  if (explicitClassGroupId) {
    if (!mongoose.Types.ObjectId.isValid(explicitClassGroupId)) {
      throw new ProvisioningServiceError("Invalid target class group id.");
    }
    const classGroup = await ClassGroup.findOne({
      _id: explicitClassGroupId,
      schoolId: input.schoolId,
      gradeId: targetGradeId,
    })
      .select({ _id: 1, capacity: 1 })
      .lean();
    if (!classGroup) {
      throw new ProvisioningServiceError(
        "Target class group does not belong to the chosen grade."
      );
    }
    if (classGroup.capacity != null) {
      const currentCount = await Student.countDocuments({
        schoolId: input.schoolId,
        classGroupId: classGroup._id,
        status: "active",
      });
      if (currentCount >= classGroup.capacity) {
        throw new ProvisioningServiceError(
          `Selected class group is at full capacity (${classGroup.capacity} students). Pick a different group.`,
          409
        );
      }
    }
    targetClassGroupId = classGroup._id as Types.ObjectId;
  } else {
    const picked = await pickLeastLoadedClassGroup({
      schoolId: input.schoolId,
      gradeId: targetGradeId,
    });
    if (!picked) {
      throw new ProvisioningServiceError(
        "No active class groups exist for the target grade. Create one before provisioning.",
        409
      );
    }
    if (picked.capacityFull) {
      throw new ProvisioningServiceError(
        "Every active class group for the target grade is at full capacity. Increase capacity or add a new group.",
        409
      );
    }
    targetClassGroupId = picked.id;
  }

  // 1. Create the Student row.
  const student = new Student({
    schoolId: input.schoolId,
    firstName: application.applicant.firstName,
    lastName: application.applicant.lastName,
    middleName: null,
    gradeId: targetGradeId,
    classGroupId: targetClassGroupId,
    sex: application.applicant.sex ?? "male",
    dateOfBirth: application.applicant.dateOfBirth ?? null,
    photoUrl: application.applicant.photoUrl ?? null,
    status: "active",
    enrolledAt: new Date(),
  });
  await student.save();

  // 2. Resolve / create the parent User (school-scoped uniqueness on email).
  const emailLower = application.guardian.email.toLowerCase().trim();
  const school = await School.findById(input.schoolId).select("name").lean<{
    name?: string;
  } | null>();
  const schoolName = school?.name ?? "your school";

  let parentUser = await User.findOne({
    email: emailLower,
    schoolId: input.schoolId,
  });
  let createdParent = false;
  if (!parentUser) {
    parentUser = new User({
      email: emailLower,
      firstName: application.guardian.firstName,
      lastName: application.guardian.lastName,
      phone: application.guardian.phone || undefined,
      role: "parent",
      schoolId: input.schoolId,
    });
    await parentUser.save();
    createdParent = true;
  } else if (parentUser.role !== "parent") {
    parentUser.role = "parent";
    await parentUser.save();
  }
  const parentUserId =
    parentUser._id instanceof Types.ObjectId
      ? parentUser._id
      : new Types.ObjectId(String(parentUser._id));

  // 3. Ensure UserMembership has the parent role.
  await UserMembership.findOneAndUpdate(
    { userId: parentUserId, schoolId: input.schoolId },
    { $addToSet: { roles: "parent" }, $set: { status: "active" } },
    { upsert: true }
  );

  // 4. Send Clerk invite if requested and not yet linked.
  let invitedParent = false;
  if (input.sendParentInvite && !parentUser.clerkUserId) {
    invitedParent = await inviteParentIfNeeded({
      emailLower,
      schoolId: input.schoolId,
      schoolName,
      guardianFirstName: application.guardian.firstName,
      guardianLastName: application.guardian.lastName,
      applicationRef: application.referenceCode,
      invitedBy: input.actorUserId,
    });
  }

  // 5. Create Guardian join row (idempotent on (userId, studentId)).
  let guardian = await Guardian.findOne({
    userId: parentUserId,
    studentId: student._id,
  });
  if (!guardian) {
    const isPrimaryNeeded =
      (await Guardian.countDocuments({ studentId: student._id })) === 0;
    guardian = await Guardian.create({
      studentId: student._id,
      userId: parentUserId,
      relationship: normalizeRelationship(application.guardian.relationship),
      occupation: application.guardian.occupation ?? null,
      isPrimary: isPrimaryNeeded,
      phone: application.guardian.phone ?? null,
      email: emailLower,
    });
  }

  // 6. Stamp application.provisioned + status.
  application.provisioned = {
    studentId: student._id as Types.ObjectId,
    guardianId: guardian._id as Types.ObjectId,
    parentUserId,
    provisionedAt: new Date(),
  };
  if (application.status !== "accepted") {
    application.status = "accepted";
  }
  await application.save();

  await AdmissionEvent.create({
    schoolId: input.schoolId,
    cycleId: application.cycleId,
    applicationId: application._id,
    actor: {
      userId: input.actorUserId,
      role: input.actorRole,
      label: input.actorLabel,
    },
    kind: "application.provisioned",
    metadata: {
      studentId: String(student._id),
      guardianId: String(guardian._id),
      parentUserId: String(parentUserId),
      classGroupId: String(targetClassGroupId),
      gradeId: String(targetGradeId),
      invitedParent,
      createdParentUser: createdParent,
    },
    at: new Date(),
  });

  return {
    applicationId: String(application._id),
    studentId: String(student._id),
    guardianId: String(guardian._id),
    parentUserId: String(parentUserId),
    classGroupId: String(targetClassGroupId),
    gradeId: String(targetGradeId),
    invitedParent,
    alreadyProvisioned: false,
  };
}
