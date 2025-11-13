/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import type { EmailOtpType } from "@supabase/supabase-js";

/** Centralized routing after login */
function decideNextPath(appUser: {
  role?: string;
  pendingOnboarding?: boolean;
  schoolId?: string | null;
}) {
  if (appUser.role === "school_admin" && appUser.pendingOnboarding) {
    return "/onboarding"; // soft landing to start school onboarding
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

/** Only allow safe internal next params */
function sanitizeNextParam(url: URL) {
  const n = url.searchParams.get("next");
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const res = NextResponse.next();

  // These appear only for PKCE or OTP-based flows
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type") as EmailOtpType | null;
  const email = url.searchParams.get("email") || undefined;

  // Debug: Log cookies received
  const cookieHeader = req.headers.get("cookie");
  console.log("Callback - Cookies received:", cookieHeader ? "Yes" : "No");
  if (cookieHeader) {
    // Log cookie names (not values for security)
    const cookieNames = cookieHeader
      .split(";")
      .map((c) => c.split("=")[0].trim());
    console.log("Callback - Cookie names:", cookieNames);
  }
  console.log("Callback - URL params:", {
    code: !!code,
    tokenHash: !!tokenHash,
    otpType,
    email,
  });

  const supabase = await supabaseServer();

  // --- 1) Establish or validate a session ---
  try {
    if (code) {
      // PKCE exchange (e.g., magic link PKCE or password signup confirmation)
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("PKCE exchange error:", error);
        return NextResponse.redirect(
          new URL("/authentication/login?error=auth", url)
        );
      }
    } else if (tokenHash && otpType) {
      // Admin-generated magic/invite/recovery links
      const { error } = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
        ...(email ? { email } : {}),
      } as any);
      if (error) {
        console.error("OTP verify error:", error);
        return NextResponse.redirect(
          new URL("/authentication/login?error=auth", url)
        );
      }
    } else {
      // For password signin: Try to get session and user
      // First, try to refresh the session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      console.log("Session check:", {
        hasSession: !!sessionData?.session,
        sessionError: sessionError?.message,
      });

      // If no session, try to get user directly
      if (sessionError || !sessionData?.session) {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        console.log("User check:", {
          hasUser: !!userData?.user,
          userError: userError?.message,
        });

        if (!userData?.user) {
          console.error(
            "No session or user found. Session error:",
            sessionError?.message,
            "User error:",
            userError?.message
          );
          return NextResponse.redirect(
            new URL("/authentication/login?error=missing_token", url)
          );
        }
        // User exists but session might not be fully synced, continue anyway
      }
      // We have a valid session or user; continue
    }
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(
      new URL("/authentication/login?error=auth", url)
    );
  }

  // --- 2) We should now have a session cookie. Fetch the Supabase user. ---
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError) {
    console.error("Get user error:", authError);
  }

  if (!auth.user) {
    console.error("No user found after session check");
    return NextResponse.redirect(
      new URL("/authentication/login?error=unauthorized", url)
    );
  }

  console.log("Auth successful for user:", auth.user.email);

  // --- 3) Link to our App user record (repair if email-linked) ---
  await connectToDatabase();

  let doc = await User.findOne({ supabaseUserId: auth.user.id })
    .select("role pendingOnboarding schoolId supabaseUserId email")
    .lean();

  if (!doc && auth.user.email) {
    const byEmail = await User.findOne({ email: auth.user.email.toLowerCase() })
      .select("role pendingOnboarding schoolId supabaseUserId email")
      .lean();

    if (byEmail && !Array.isArray(byEmail)) {
      if (
        !("supabaseUserId" in byEmail) ||
        !byEmail.supabaseUserId ||
        String(byEmail.supabaseUserId).startsWith("temp_")
      ) {
        await User.updateOne(
          { _id: byEmail._id },
          { $set: { supabaseUserId: auth.user.id } }
        );
      }
      doc = { ...byEmail, supabaseUserId: auth.user.id } as typeof byEmail;
    }
  }

  if (!doc) {
    // You can soft-create here if you want; for now, bounce to login with a clear error
    return NextResponse.redirect(
      new URL("/authentication/login?error=user_not_found", url)
    );
  }

  const appUser = {
    role: (doc as any).role as string | undefined,
    pendingOnboarding: !!(doc as any).pendingOnboarding,
    schoolId: (doc as any).schoolId ? String((doc as any).schoolId) : null,
  };

  // --- 4) Optional ?next= override (internal-only) ---
  const safeNext = sanitizeNextParam(url);
  const dest = safeNext || decideNextPath(appUser);

  return NextResponse.redirect(new URL(dest, url));
}
