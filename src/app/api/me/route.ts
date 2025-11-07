// import { NextResponse } from "next/server";
// import { supabaseServer } from "@/lib/supabase/server";
// import { connectToDatabase } from "@/db/connectToDatabase";
// import { User, type IUser } from "@/models/User";
// import { School } from "@/models/School";

// export async function GET() {
//   const supabase = await supabaseServer();
//   const { data, error } = await supabase.auth.getUser();
//   if (error || !data.user) {
//     console.log(error);
//     return NextResponse.json(
//       { ok: false, reason: "unauthorized" },
//       { status: 401 }
//     );
//   }

//   await connectToDatabase();
//   const appUserResult = await User.findOne({
//     supabaseUserId: data.user.id,
//   }).lean();
//   const appUser = appUserResult as IUser | null;

//   if (!appUser) {
//     return NextResponse.json({ ok: false, reason: "no_user" }, { status: 404 });
//   }

//   let school: any = null;
//   if (appUser.schoolId) {
//     school = await School.findById(appUser.schoolId).lean();
//   }

//   // Get primary role (prioritize platform_admin, otherwise use first role)
//   const primaryRole: string | undefined = appUser.roles.includes(
//     "platform_admin"
//   )
//     ? "platform_admin"
//     : appUser.roles[0];
//   // Normalize role name for client (convert camelCase to snake_case for consistency)
//   const role: string =
//     primaryRole === "school_admin" ? "school_admin" : primaryRole || "";

//   const pendingOnboardingBool: boolean =
//     role === "school_admin" || primaryRole === "school_admin"
//       ? !!(school
//           ? school.onboarding?.completed === false
//           : appUser.pendingOnboarding)
//       : false;

// Redirect to appropriate dashboard based on role
// Routes match the actual protected route structure:
// - platform_admin -> /appsentrix (protected route)
// - school_admin -> /admin (protected route)
// - teacher -> /teacher (protected route)
// - parent -> /parent (protected route)
// - student -> /student (protected route)
// - bursar -> /bursar (protected route)
//   let redirect = "/";
//   if (role === "platform_admin") {
//     redirect = "/appsentrix";
//   } else if (role === "school_admin" || primaryRole === "school_admin") {
//     redirect = pendingOnboardingBool ? "/onboard" : "/admin";
//   } else if (primaryRole === "teacher") {
//     redirect = "/teacher";
//   } else if (primaryRole === "parent") {
//     redirect = "/parent";
//   } else if (primaryRole === "student") {
//     redirect = "/student";
//   } else if (primaryRole === "bursar") {
//     redirect = "/bursar";
//   }

//   return NextResponse.json({
//     ok: true,
//     user: {
//       id: appUser._id?.toString(),
//       email: appUser.email,
//       name:
//         [appUser.firstName, appUser.lastName].filter(Boolean).join(" ") || "",
//       role,
//       schoolId: appUser.schoolId?.toString() ?? null,
//       pendingOnboarding: pendingOnboardingBool,
//     },
//     school: school
//       ? {
//           id: school._id.toString(),
//           name: school.name,
//           status: school.status,
//           onboardingCompleted: !!school.onboarding?.completed,
//         }
//       : null,
//     redirect,
//   });
// }

// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";

export async function GET() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectToDatabase();
  const appUser = await User.findOne({ supabaseUserId: data.user.id })
    .select(
      "_id email firstName  lastName avatartUrl role pendingOnboarding schoolId"
    )
    .lean<IUser>();

  if (!appUser)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const name = [appUser.firstName, appUser.lastName].filter(Boolean).join(" ");

  return NextResponse.json({
    _id: String(appUser._id),
    email: appUser.email,
    name,
    role: appUser.role ?? undefined,
    pendingOnboarding: !!appUser.pendingOnboarding,
    schoolId: appUser.schoolId ? String(appUser.schoolId) : null,
    avatarUrl: appUser.avatarUrl,
  });
}
