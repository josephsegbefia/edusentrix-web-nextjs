import { auth } from "@clerk/nextjs/server";
import type { Types } from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { School, type ISchool } from "@/models/School";
import { normalizePaymentSetupEmail } from "@/lib/school-payments/payment-setup";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

function legacyRoleToArray(role?: string) {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "bursar") return ["bursar"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

type PaymentSetupAccessContext = {
  userId: NonNullable<IUser["_id"]>;
  schoolId: NonNullable<IUser["schoolId"]>;
  school: Pick<ISchool, "_id" | "createdBy" | "billing" | "bank" | "name">;
  roles: string[];
  accessMode:
    | "billing_owner"
    | "finance_delegate"
    | "school_creator"
    | "admin_fallback"
    | "school_admin_readonly";
  userEmail: string;
  userName: string | null;
  shouldBindOwnerUserId: boolean;
  shouldBindDelegateUserId: boolean;
  capabilities: {
    canView: boolean;
    canManage: boolean;
    canManageDelegate: boolean;
    canInviteOwner: boolean;
    canApprovePayoutChange: boolean;
  };
};

export async function requirePaymentSetupAccess(): Promise<PaymentSetupAccessContext> {
  await connectToDatabase();

  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    await ensureActiveSchoolForTenant(assisted.schoolId, { mode: "api" });
    const school = await School.findById(assisted.schoolId)
      .select("name createdBy bank billing")
      .lean<Pick<ISchool, "_id" | "createdBy" | "billing" | "bank" | "name"> | null>();

    if (!school) {
      throw NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    return {
      userId: assisted.actorUserId,
      schoolId: assisted.schoolId,
      school,
      roles: ["school_admin"],
      accessMode: "admin_fallback",
      userEmail: assisted.actorEmail,
      userName: assisted.actorName,
      shouldBindOwnerUserId: false,
      shouldBindDelegateUserId: false,
      capabilities: {
        canView: true,
        canManage: true,
        canManageDelegate: false,
        canInviteOwner: true,
        canApprovePayoutChange: false,
      },
    };
  }

  let resolvedUserId: string | null = null;

  const demo = await tryResolveDemoGuard();
  if (demo.isDemo) {
    resolvedUserId = "__demo__";
  }

  if (!resolvedUserId) {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    resolvedUserId = clerkUserId;
  }

  let userRaw;
  if (demo.isDemo) {
    userRaw = await User.findById(demo.user._id).lean();
  } else {
    userRaw = await User.findOne({ clerkUserId: resolvedUserId }).lean();
  }
  const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as Pick<
    IUser,
    "_id" | "schoolId" | "role" | "email" | "name" | "firstName" | "lastName"
  > | null;

  if (!user) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "School context is missing for this account" },
      { status: 400 }
    );
  }

  await ensureActiveSchoolForTenant(user.schoolId as Types.ObjectId, { mode: "api" });

  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });

  if (!membership) {
    membership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
  }

  const roles = membership.roles || [];
  const school = await School.findById(user.schoolId)
    .select("name createdBy bank billing")
    .lean<Pick<ISchool, "_id" | "createdBy" | "billing" | "bank" | "name"> | null>();

  if (!school) {
    throw NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  const normalizedEmail = normalizePaymentSetupEmail(user.email);
  const explicitOwnerUserId = school.billing?.paymentSetup?.ownerUserId
    ? String(school.billing.paymentSetup.ownerUserId)
    : null;
  const explicitOwnerEmail = school.billing?.paymentSetup?.ownerEmail
    ? normalizePaymentSetupEmail(school.billing.paymentSetup.ownerEmail)
    : null;
  const explicitDelegateUserId = school.billing?.paymentSetup?.delegateUserId
    ? String(school.billing.paymentSetup.delegateUserId)
    : null;
  const explicitDelegateEmail = school.billing?.paymentSetup?.delegateEmail
    ? normalizePaymentSetupEmail(school.billing.paymentSetup.delegateEmail)
    : null;
  const isSchoolAdmin = roles.includes("school_admin");
  let accessMode: PaymentSetupAccessContext["accessMode"] | null = null;
  let shouldBindOwnerUserId = false;
  let shouldBindDelegateUserId = false;

  if (explicitOwnerUserId && explicitOwnerUserId === String(user._id)) {
    accessMode = "billing_owner";
  } else if (
    explicitOwnerEmail &&
    explicitOwnerEmail === normalizedEmail
  ) {
    accessMode = "billing_owner";
    shouldBindOwnerUserId = !explicitOwnerUserId;
  } else if (
    explicitDelegateUserId &&
    explicitDelegateUserId === String(user._id)
  ) {
    accessMode = "finance_delegate";
  } else if (
    explicitDelegateEmail &&
    explicitDelegateEmail === normalizedEmail
  ) {
    accessMode = "finance_delegate";
    shouldBindDelegateUserId = !explicitDelegateUserId;
  } else if (
    !explicitOwnerUserId &&
    school.createdBy &&
    String(school.createdBy) === String(user._id) &&
    isSchoolAdmin
  ) {
    accessMode = "school_creator";
  } else if (!explicitOwnerUserId && isSchoolAdmin) {
    accessMode = "admin_fallback";
  } else if (explicitOwnerUserId && isSchoolAdmin) {
    accessMode = "school_admin_readonly";
  }

  if (!accessMode) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canManage = accessMode !== "school_admin_readonly";
  const capabilities = {
    canView: true,
    canManage,
    canManageDelegate: accessMode === "billing_owner",
    canInviteOwner:
      accessMode === "billing_owner" ||
      accessMode === "school_creator" ||
      accessMode === "admin_fallback",
    canApprovePayoutChange: accessMode === "billing_owner",
  };

  return {
    userId: user._id,
    schoolId: user.schoolId,
    school,
    roles,
    accessMode,
    userEmail: user.email,
    userName:
      user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    shouldBindOwnerUserId,
    shouldBindDelegateUserId,
    capabilities,
  };
}
