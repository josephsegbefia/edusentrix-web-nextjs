// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { IUser } from "@/models/User";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import mongoose from "mongoose";
import {
  schoolIdFromClerkMetadata,
} from "@/lib/auth/resolveTenantUserForClerkSession";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
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

  let appUser: IUser;
  try {
    appUser = await ensureCanonicalUserForClerkSession({
      clerkUserId: userId,
      email,
      role: role ?? undefined,
      schoolId: schoolIdFromMetadata,
      firstName: cUser.firstName,
      lastName: cUser.lastName,
      avatarUrl: cUser.imageUrl,
    });
  } catch (resolveError) {
    const errUrl = new URL("/sign-in", req.url);
    errUrl.searchParams.set("error", "identity_resolution_failed");
    console.error("Auth callback identity resolution failed:", resolveError);
    return NextResponse.redirect(errUrl);
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

  const activeSchool = await resolveActiveSchoolContext({ clerkUserId: userId });
  const dest =
    safeNext(url) ??
    (activeSchool.ok ? activeSchool.context.homePath : null) ??
    decideNextPath({
      role: appUser.role,
      pendingOnboarding: !!appUser.pendingOnboarding,
    });

  return NextResponse.redirect(new URL(dest, url));
}
