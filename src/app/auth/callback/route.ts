/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

function decideNextPath(appUser: {
  role?: string;
  pendingOnboarding?: boolean;
}) {
  if (appUser.role === "school_admin" && appUser.pendingOnboarding)
    return "/onboarding";
  switch (appUser.role) {
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

// internal-only
function sanitizeNextParam(url: URL) {
  const n = url.searchParams.get("next");
  if (!n || !n.startsWith("/")) return null;
  return n;
}

export async function GET(req: NextRequest) {
  // With Clerk, the session cookie is already set here
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in?error=unauthorized", req.url)
    );
  }

  await connectToDatabase();

  // Try find Mongo user by clerkUserId; if missing, bind via email
  const docRaw = await User.findOne({ clerkUserId: userId })
    .select("role pendingOnboarding email")
    .lean();

  // Normalize to ensure it's a single document, not an array
  const docRawNormalized = Array.isArray(docRaw) ? docRaw[0] : docRaw;
  let doc: { role?: any; pendingOnboarding?: any; email?: any } | null =
    docRawNormalized as any;

  if (!doc) {
    const cu = await clerkCurrentUser();
    const email = cu?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (!email) {
      return NextResponse.redirect(
        new URL("/sign-in?error=user_not_found", req.url)
      );
    }

    const byEmailRaw = await User.findOne({ email }).lean();
    if (!byEmailRaw) {
      return NextResponse.redirect(
        new URL("/sign-in?error=user_not_found", req.url)
      );
    }

    // Normalize to ensure it's a single document, not an array
    const byEmail = Array.isArray(byEmailRaw) ? byEmailRaw[0] : byEmailRaw;
    if (!byEmail) {
      return NextResponse.redirect(
        new URL("/sign-in?error=user_not_found", req.url)
      );
    }

    // Type assertion to access properties from Mongoose lean result
    const byEmailTyped = byEmail as any;
    await User.updateOne(
      { _id: byEmailTyped._id },
      { $set: { clerkUserId: userId } }
    );
    doc = {
      role: byEmailTyped.role,
      pendingOnboarding: byEmailTyped.pendingOnboarding,
      email: byEmailTyped.email,
    } as any;
  }

  if (!doc) {
    return NextResponse.redirect(
      new URL("/sign-in?error=user_not_found", req.url)
    );
  }

  const safeNext = sanitizeNextParam(new URL(req.url));
  const dest =
    safeNext ||
    decideNextPath({
      role: doc.role,
      pendingOnboarding: !!doc.pendingOnboarding,
    });

  return NextResponse.redirect(new URL(dest, req.url));
}
