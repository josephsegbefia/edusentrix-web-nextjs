import mongoose from "mongoose";
import type { CurriculumCode } from "@/constants/curriculum-profiles";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformTask } from "@/models/PlatformTask";
import { School, type SchoolType } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

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
  const existingAdmin = await User.findOne({
    email: normalizedAdminEmail,
    schoolId: school._id,
  });
  const nameParts = splitName(input.admin.fullName);
  const adminUser =
    existingAdmin ||
    (await User.create({
      email: normalizedAdminEmail,
      name: input.admin.fullName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: input.admin.phone || undefined,
      role: "school_admin",
      schoolId: school._id,
      pendingOnboarding: true,
    }));

  await UserMembership.updateOne(
    { userId: adminUser._id, schoolId: school._id },
    {
      $setOnInsert: {
        userId: adminUser._id,
        schoolId: school._id,
        roles: ["school_admin"],
        status: "invited",
        invitedBy: input.actorUserId,
        invitedAt: new Date(),
      },
    },
    { upsert: true }
  );

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
    },
  });

  return { school, adminUser, task };
}
