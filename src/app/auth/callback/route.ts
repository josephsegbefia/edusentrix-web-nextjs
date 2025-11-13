/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

/** Decide a default destination from app-side role/state */
function decideNextPath(appUser: {
  role?: string;
  pendingOnboarding?: boolean;
  schoolId?: string | null;
}) {
  // Hard requirement: school_admins who haven't onboarded must go to onboarding.
  if (appUser.role === "school_admin" && appUser.pendingOnboarding) {
    return "/onboarding";
  }
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

/** Only allow internal, absolute-path next params */
function sanitizeNextParam(url: URL) {
  const n = url.searchParams.get("next");
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Supabase can return either:
  // - PKCE `code` (e.g., signInWithOtp/signInWithPassword redirect)
  // - Admin link `token_hash` + `type` (e.g., magiclink, recovery, invite)
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type"); // "magiclink" | "recovery" | "invite" | "signup" | "email_change"
  const email = url.searchParams.get("email") || undefined;

  const supabase = await supabaseServer();

  // 1) Establish a Supabase session
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          new URL("/authentication/login?error=auth", url)
        );
      }
    } else if (tokenHash && otpType) {
      const { error } = await supabase.auth.verifyOtp({
        type: otpType as any,
        token_hash: tokenHash,
        ...(email ? { email } : {}),
      } as any);
      if (error) {
        return NextResponse.redirect(
          new URL("/authentication/login?error=auth", url)
        );
      }
    } else {
      return NextResponse.redirect(
        new URL("/authentication/login?error=missing_token", url)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/authentication/login?error=auth", url)
    );
  }

  // 2) We should now have a Supabase session cookie.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.redirect(
      new URL("/authentication/login?error=unauthorized", url)
    );
  }

  // 3) Load/repair our App user record in Mongo
  await connectToDatabase();

  // Prefer lookup by supabaseUserId
  let doc = await User.findOne({ supabaseUserId: auth.user.id })
    .select("role pendingOnboarding schoolId supabaseUserId email")
    .lean();

  // Fallback: lookup by email if not found (covers pre-created rows with temp_ ids)
  if (!doc && auth.user.email) {
    const byEmailRaw = await User.findOne({
      email: auth.user.email.toLowerCase(),
    })
      .select("role pendingOnboarding schoolId supabaseUserId email")
      .lean();

    const byEmail = Array.isArray(byEmailRaw) ? null : byEmailRaw;

    if (byEmail) {
      // Repair temp/blank supabaseUserId → real auth.user.id
      if (
        !byEmail.supabaseUserId ||
        byEmail.supabaseUserId.startsWith("temp_")
      ) {
        await User.updateOne(
          { _id: (byEmail as any)._id },
          { $set: { supabaseUserId: auth.user.id } }
        );
      }
      doc = { ...byEmail, supabaseUserId: auth.user.id } as typeof byEmail;
    }
  }

  if (!doc) {
    // You can soft-create here instead, if desired.
    return NextResponse.redirect(
      new URL("/authentication/login?error=user_not_found", url)
    );
  }

  const appUser = {
    role: (doc as any).role as string | undefined,
    pendingOnboarding: !!(doc as any).pendingOnboarding,
    schoolId: (doc as any).schoolId ? String((doc as any).schoolId) : null,
  };

  // 4) Routing rules
  // If onboarding is required, force /onboarding (ignore ?next=)
  if (appUser.role === "school_admin" && appUser.pendingOnboarding) {
    return NextResponse.redirect(new URL("/onboarding", url));
  }

  // Otherwise, allow safe next= override; fall back to role-based
  const safeNext = sanitizeNextParam(url);
  const dest = safeNext || decideNextPath(appUser);
  return NextResponse.redirect(new URL(dest, url));
}
