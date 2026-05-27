// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import mongoose from "mongoose";
import {
  resolveTenantUserForClerkSession,
  schoolIdFromClerkMetadata,
} from "@/lib/auth/resolveTenantUserForClerkSession";
import {
  bindBillingOwnerToSchool,
  bindPaymentSetupDelegateToSchool,
  replaceBillingOwnerOnSchool,
} from "@/lib/school-payments/billing-owner-lifecycle";
/** Role-based landing */
function decideNextPath(u: {
  role?: string;
  pendingOnboarding?: boolean;
}): string {
  if (u.role === "school_admin" && u.pendingOnboarding) return "/launch";
  switch (u.role) {
    case "platform_admin":
    case "platformAdmin":
      return "/platform";
    case "school_admin":
    case "schoolAdmin":
      return "/admin";
    case "billing_owner":
      return "/admin/settings/payment-setup";
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "student":
      return "/student";
    case "bursar":
      return "/bursar";
    default:
      return "/dashboard";
  }
}

/** Only allow internal relative ?next=/... */
function safeNext(url: URL) {
  const n = url.searchParams.get("next");
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { userId } = await auth();

  // No active session → back to sign-in
  if (!userId) {
    url.pathname = "/sign-in";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  // Get Clerk user + ensure Mongo user
  const clerk = await clerkClient();
  const cUser = await clerk.users.getUser(userId);

  const email = cUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
  const role =
    (cUser.publicMetadata?.role as string | undefined) ||
    (cUser.privateMetadata?.role as string | undefined);
  const schoolIdFromMetadata = schoolIdFromClerkMetadata(cUser);

  await connectToDatabase();

  let appUser: IUser | null = await resolveTenantUserForClerkSession({
    clerkUserId: userId,
    email,
    schoolIdFromMetadata,
  });

  if (!appUser) {
    if (email) {
      const dup = await User.countDocuments({ email: email.toLowerCase() });
      if (dup > 1) {
        const errUrl = new URL("/sign-in", req.url);
        errUrl.searchParams.set("error", "multi_school_email");
        return NextResponse.redirect(errUrl);
      }
    }
    const created = await User.create({
      clerkUserId: userId,
      email,
      role: role ?? undefined,
      pendingOnboarding: role === "school_admin" ? true : false,
      schoolId: schoolIdFromMetadata || undefined,
    });
    appUser = created.toObject() as IUser;
  }

  // If role not set in DB but present in Clerk metadata, persist it
  if (!appUser.role && role) {
    await User.updateOne({ _id: appUser._id }, { $set: { role } });
    appUser.role = role as IUser["role"];
  }
  if (!appUser.schoolId && schoolIdFromMetadata) {
    await User.updateOne(
      { _id: appUser._id },
      { $set: { schoolId: schoolIdFromMetadata } }
    );
    appUser.schoolId = schoolIdFromMetadata as unknown as IUser["schoolId"];
  }

  // Mark any pending invitations for this email as accepted
  // This handles teacher/staff invitations that were sent via the school admin
  if (email) {
    try {
      const inviteMatch: Record<string, unknown> = {
        email: email.toLowerCase(),
        status: "pending",
      };
      if (schoolIdFromMetadata && mongoose.isValidObjectId(schoolIdFromMetadata)) {
        inviteMatch.schoolId = new mongoose.Types.ObjectId(schoolIdFromMetadata);
      }
      await Invitation.updateMany(inviteMatch, {
        $set: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      });
    } catch (invitationError) {
      // Don't fail the callback if invitation update fails
      console.error("Failed to update invitation status:", invitationError);
    }
  }

  const effectiveSchoolId = appUser.schoolId || schoolIdFromMetadata;
  if (appUser.role === "billing_owner" && effectiveSchoolId && email) {
    const ownerInvitation = await Invitation.findOne({
      email,
      schoolId: effectiveSchoolId,
      role: "billing_owner",
      status: { $in: ["accepted", "pending"] },
    })
      .sort({ acceptedAt: -1, sentAt: -1 })
      .lean<{ metadata?: { paymentAuthorityMode?: string } | null } | null>();

    if (ownerInvitation?.metadata?.paymentAuthorityMode === "owner_replacement") {
      await replaceBillingOwnerOnSchool({
        schoolId: String(effectiveSchoolId),
        userId: String(appUser._id),
        email,
        name:
          appUser.name ||
          [appUser.firstName, appUser.lastName].filter(Boolean).join(" ") ||
          null,
      });
    } else {
      await bindBillingOwnerToSchool({
        schoolId: String(effectiveSchoolId),
        userId: String(appUser._id),
        email,
        name:
          appUser.name ||
          [appUser.firstName, appUser.lastName].filter(Boolean).join(" ") ||
          null,
      });
    }
  }

  if (appUser.role === "bursar" && effectiveSchoolId && email) {
    await bindPaymentSetupDelegateToSchool({
      schoolId: String(effectiveSchoolId),
      userId: String(appUser._id),
      email,
      name:
        appUser.name ||
        [appUser.firstName, appUser.lastName].filter(Boolean).join(" ") ||
        null,
    });
  }

  if (
    appUser.role !== "platform_admin" &&
    effectiveSchoolId &&
    mongoose.isValidObjectId(String(effectiveSchoolId))
  ) {
    const suspendedSchool = await School.findById(effectiveSchoolId)
      .select("status")
      .lean<{ status?: string } | null>();
    if (suspendedSchool?.status === "deactivated") {
      const errUrl = new URL("/sign-in", req.url);
      errUrl.searchParams.set("error", "school_disabled");
      return NextResponse.redirect(errUrl);
    }
  }

  const dest =
    safeNext(url) ??
    decideNextPath({
      role: appUser.role,
      pendingOnboarding: !!appUser.pendingOnboarding,
    });

  return NextResponse.redirect(new URL(dest, url));
}
