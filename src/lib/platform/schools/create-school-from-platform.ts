import mongoose from "mongoose";
import type { CurriculumCode } from "@/constants/curriculum-profiles";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformTask } from "@/models/PlatformTask";
import { School, type SchoolType } from "@/models/School";
import { assignPilotSubscription } from "@/lib/subscriptions/assign-pilot-subscription";
import {
  ensureCanonicalUserForEmail,
  ensureMembershipForUser,
} from "@/lib/auth/canonical-user";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import type { InvitationEmailStatus } from "@/lib/invitations/delivery-copy";

export type SchoolContactEmailStatus =
  | "sent"
  | "queued"
  | "failed"
  | "not_provided"
  | "same_as_admin";

export type CreateSchoolFromPlatformInput = {
  actorUserId: mongoose.Types.ObjectId;
  school: {
    name: string;
    type: SchoolType;
    curriculumCode: CurriculumCode;
    address?: string;
    city?: string;
    region?: string;
    email?: string;
    phone?: string;
    gesSchoolCode?: string;
  };
  admin: {
    fullName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
  };
};

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || fullName,
    lastName: parts.slice(1).join(" "),
  };
}

async function sendSchoolCreatedContactEmail(input: {
  schoolId: mongoose.Types.ObjectId;
  schoolName: string;
  schoolEmail: string;
  actorUserId: mongoose.Types.ObjectId;
}): Promise<SchoolContactEmailStatus> {
  const rendered = renderTemplate("SCHOOL_CREATED_CONTACT", {
    schoolName: input.schoolName,
  });

  const result = await sendTrackedBrevoEmail({
    to: input.schoolEmail,
    subject: rendered.subject,
    htmlContent: rendered.htmlContent,
    textContent: rendered.textContent,
    templateKey: "SCHOOL_CREATED_CONTACT",
    schoolId: String(input.schoolId),
    schoolName: input.schoolName,
    actorId: String(input.actorUserId),
    actorRole: "platform_admin",
    relatedEntityType: "School",
    relatedEntityId: String(input.schoolId),
    enqueueOnFailure: true,
  });

  if (result.status === "sent") return "sent";
  if (result.status === "queued") return "queued";
  return "failed";
}

export async function createSchoolFromPlatform(input: CreateSchoolFromPlatformInput) {
  const school = await School.create({
    name: input.school.name,
    type: input.school.type,
    curriculumCode: input.school.curriculumCode,
    address: input.school.address || undefined,
    city: input.school.city || undefined,
    region: input.school.region || undefined,
    email: input.school.email || undefined,
    gesSchoolCode: input.school.gesSchoolCode || null,
    status: "pending",
    createdBy: input.actorUserId,
    billing: {
      status: "unprovisioned",
      paymentSetup: {
        status: "not_started",
      },
    },
  });

  const normalizedAdminEmail = input.admin.email.toLowerCase().trim();
  const nameParts = splitName(input.admin.fullName);
  const adminUser = await ensureCanonicalUserForEmail({
    email: normalizedAdminEmail,
    name: input.admin.fullName,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    phone: input.admin.phone || undefined,
    role: "school_admin",
    schoolId: school._id,
    pendingOnboarding: true,
  });

  await ensureMembershipForUser({
    userId: adminUser._id,
    schoolId: school._id,
    role: "school_admin",
    status: "invited",
  });

  const task = await PlatformTask.create({
    schoolId: school._id,
    title: `Set up ${school.name}`,
    description: "Initial school setup task created from platform console.",
    category: "school_onboarding",
    priority: "normal",
    status: "todo",
    assignedToUserId: null,
    assignedByUserId: input.actorUserId,
    dueAt: null,
    relatedEntityType: "School",
    relatedEntityId: school._id,
    checklist: [],
  });

  let adminInvitation = {
    invitationId: null as string | null,
    status: "failed" as "pending" | "failed",
    emailStatus: "failed" as InvitationEmailStatus,
    warning: undefined as string | undefined,
  };

  try {
    const issued = await issueInvitation({
      email: normalizedAdminEmail,
      role: "school_admin",
      schoolId: school._id,
      invitedBy: input.actorUserId,
      recipientName: input.admin.fullName,
      schoolName: school.name,
      recipientUserId: String(adminUser._id),
      actorRole: "platform_admin",
      relatedEntityType: "School",
      relatedEntityId: String(school._id),
      invitationMetadata: {
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        name: input.admin.fullName,
        jobTitle: input.admin.jobTitle,
        accessSurface: "school_admin_onboarding",
        source: "platform_school_create",
      },
    });
    adminInvitation = {
      invitationId: issued.invitationId,
      status: issued.invitationStatus,
      emailStatus: issued.emailStatus,
      warning: issued.warning,
    };
  } catch (err) {
    console.error("[createSchoolFromPlatform] admin invitation failed:", err);
    adminInvitation.warning =
      err instanceof Error ? err.message : "Failed to issue admin invitation";
  }

  const schoolEmail = input.school.email?.toLowerCase().trim() || "";
  let schoolContactEmail: { status: SchoolContactEmailStatus } = {
    status: "not_provided",
  };

  if (!schoolEmail) {
    schoolContactEmail = { status: "not_provided" };
  } else if (schoolEmail === normalizedAdminEmail) {
    schoolContactEmail = { status: "same_as_admin" };
  } else {
    try {
      const status = await sendSchoolCreatedContactEmail({
        schoolId: school._id,
        schoolName: school.name,
        schoolEmail,
        actorUserId: input.actorUserId,
      });
      schoolContactEmail = { status };
    } catch (err) {
      console.error("[createSchoolFromPlatform] school contact email failed:", err);
      schoolContactEmail = { status: "failed" };
    }
  }

  await PlatformAuditLog.create({
    actorId: input.actorUserId,
    schoolId: school._id,
    action: "platform.school.created",
    entityType: "School",
    entityId: school._id,
    metadata: {
      adminUserId: String(adminUser._id),
      setupTaskId: String(task._id),
      createdVia: "platform_operations_console",
      adminInvitationStatus: adminInvitation.status,
      adminEmailStatus: adminInvitation.emailStatus,
      schoolContactEmailStatus: schoolContactEmail.status,
    },
  });

  try {
    await assignPilotSubscription({
      schoolId: school._id,
      actorEmail: null,
    });
  } catch (err) {
    console.error("[createSchoolFromPlatform] Failed to assign pilot subscription:", err);
  }

  return {
    school,
    adminUser,
    task,
    adminInvitation,
    schoolContactEmail,
  };
}
