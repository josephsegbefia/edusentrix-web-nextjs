export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User, type IUser } from "@/models/User";
import { ISchool, School } from "@/models/School";

type Role = "platform_admin" | "schoolAdmin" | "teacher" | "parent" | "student";

function normalizeRole(r?: string): Role | null {
  if (!r) return null;
  const v = r.toLowerCase();
  if (v === "platform_admin" || v === "platformadmin") return "platform_admin";
  if (v === "schooladmin" || v === "school_admin" || v === "admin")
    return "schoolAdmin";
  if (v === "teacher") return "teacher";
  if (v === "parent") return "parent";
  if (v === "student") return "student";

  return null;
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await connectToDatabase();

  // Find appuser by supabase UID
  const appUserResult = await User.findOne({
    supabaseUserId: data.user.id,
  }).lean();
  const appUser = appUserResult as IUser | null;

  if (!appUser) {
    // minimal fallback so UI can still proceed (user can be freshly invited)

    return NextResponse.json({
      ok: true,
      user: {
        id: null,
        email: data.user.email,
        name: data.user.user_metadata?.name ?? "",
        role: null,
        schoolId: null,
        pendingOnboarding: true,
      },
    });
  }

  // Get primary role (prioritize platform_admin, otherwise use first role)
  const primaryRole = appUser.roles.includes("platform_admin")
    ? "platform_admin"
    : appUser.roles[0];
  const role = normalizeRole(primaryRole);
  let schoolInfo: null | {
    id: string;
    name?: string;
    status?: string;
    billing?: unknown;
  } = null;

  if (appUser.schoolId) {
    const foundSchool = await School.findById(appUser.schoolId).lean();

    const school = foundSchool as ISchool | null;

    if (school) {
      schoolInfo = {
        id: String(school._id),
        name: school.name,
        status: school.status,
        billing: school.billing ?? null,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: String(appUser._id),
      email: appUser.email,
      firstName: appUser.firstName,
      lastName: appUser.lastName,
      role,
      schoolId: appUser.schoolId ? String(appUser.schoolId) : null,
      pendingOnboarding: !!appUser.pendingOnboarding,
      // Extra we may need in client
      phone: appUser.phone ?? null,
      avatarUrl: appUser.avatarUrl ?? null,
    },
    school: schoolInfo,
  });
}
