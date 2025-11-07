export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

type AppUserLean = {
  role?: string;
  pendingOnboarding?: boolean;
  schoolId?: string | null;
};

// Centralized decision for where to send the user next
function decideNextPath(u: AppUserLean) {
  if (u.pendingOnboarding && u.schoolId) return "/onboard";

  console.log(u);
  switch (u.role) {
    case "platform_admin":
      return "/platform";
    case "school_admin":
      return "/admin"; // adjust if your admin home is different
    case "teacher":
      return "/teacher";
    case "parent":
      return "/parent";
    case "student":
      return "/student";
    default:
      return "/dashboard"; // safe fallback
  }
}

// Only honor safe, relative next params
function sanitizeNextParam(url: URL) {
  const next = url.searchParams.get("next");
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  return next;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // For PKCE magic links we must receive ?code=
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url));
  }

  const supabase = await supabaseServer();

  // 1) Exchange code for a session and set cookies
  const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchErr) {
    return NextResponse.redirect(new URL("/login?error=auth", url));
  }

  // 2) Get the Supabase user
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", url));
  }

  // 3) Load App user and decide where to go
  await connectToDatabase();
  const doc = await User.findOne({ supabaseUserId: auth.user.id })
    .select("role pendingOnboarding schoolId")
    .lean<{ role?: string; pendingOnboarding?: boolean; schoolId?: unknown }>();

  // Shape the lean user to our small interface
  const appUser: AppUserLean = {
    role: doc?.role,
    pendingOnboarding: !!doc?.pendingOnboarding,
    schoolId: doc?.schoolId ? String(doc.schoolId) : null,
  };

  // 4) Optional `?next=` override if provided and safe
  const safeNext = sanitizeNextParam(url);
  const destination = safeNext || decideNextPath(appUser);

  return NextResponse.redirect(new URL(destination, url));
}
