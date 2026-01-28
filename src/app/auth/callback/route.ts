// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { Invitation } from "@/models/Invitation";

/** Role-based landing */
function decideNextPath(u: {
  role?: string;
  pendingOnboarding?: boolean;
}): string {
  if (u.role === "school_admin" && u.pendingOnboarding) return "/onboarding";
  switch (u.role) {
    case "platform_admin":
    case "platformAdmin":
      return "/platform";
    case "school_admin":
    case "schoolAdmin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "student":
      return "/student";
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

  await connectToDatabase();

  // Find by clerkUserId, else fallback to email, then repair link
  let appUser: IUser | null = (await User.findOne({
    clerkUserId: userId,
  }).lean()) as IUser | null;
  if (!appUser && email) {
    const byEmail = (await User.findOne({ email }).lean()) as IUser | null;
    if (byEmail) {
      await User.updateOne(
        { _id: byEmail._id },
        { $set: { clerkUserId: userId } }
      );
      appUser = { ...byEmail, clerkUserId: userId };
    }
  }
  // Soft-create if still not found (unscoped user)
  if (!appUser) {
    const created = await User.create({
      clerkUserId: userId,
      email,
      role: role ?? undefined,
      pendingOnboarding: role === "school_admin" ? true : false,
    });
    appUser = created.toObject() as IUser;
  }

  // If role not set in DB but present in Clerk metadata, persist it
  if (!appUser.role && role) {
    await User.updateOne({ _id: appUser._id }, { $set: { role } });
    appUser.role = role as IUser["role"];
  }

  // Mark any pending invitations for this email as accepted
  // This handles teacher/staff invitations that were sent via the school admin
  if (email) {
    try {
      await Invitation.updateMany(
        {
          email: email.toLowerCase(),
          status: "pending",
        },
        {
          $set: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        }
      );
    } catch (invitationError) {
      // Don't fail the callback if invitation update fails
      console.error("Failed to update invitation status:", invitationError);
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
