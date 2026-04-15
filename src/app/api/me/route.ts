// src/app/api/me/route.ts
// import { NextResponse } from "next/server";
// import { auth } from "@clerk/nextjs/server";
// import { getCurrentUser } from "@/lib/auth/get-current-user";

// export async function GET() {
//   const { userId } = await auth();
//   if (!userId) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   const me = await getCurrentUser();
//   if (!me) {
//     return NextResponse.json({ error: "No profile" }, { status: 404 });
//   }
//   return NextResponse.json(me);
// }

// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { isDemoMode } from "@/lib/demo/runtime";
import { resolveDemoSessionFromCookie } from "@/lib/demo/session";
import { resolveDemoPersona } from "@/lib/demo/persona";
import { connectToDatabase } from "@/db/connectToDatabase";

function computeRedirect(me: Awaited<ReturnType<typeof getCurrentUser>>) {
  // Keep it consistent with your web routing rules.
  if (!me) return null;

  // Example logic — tweak to match your app:
  if (me.pendingOnboarding) return "/launch";
  if (me.role === "school_admin") return "/admin";
  if (me.role === "billing_owner") return "/admin/settings/payment-setup";
  if (me.role === "platform_admin") return "/platform";
  if (me.role === "teacher") return "/teacher";
  if (me.role === "parent") return "/parent";
  if (me.role === "student") return "/student";
  if (me.role === "bursar") return "/bursar";
  return null;
}

export async function GET(req: NextRequest) {
  // ─── Demo mode: resolve from demo session cookie ───
  if (isDemoMode()) {
    await connectToDatabase();
    const session = await resolveDemoSessionFromCookie();
    if (session) {
      const persona = await resolveDemoPersona(session);
      if (persona) {
        const redirect = computeRedirect(persona);
        return NextResponse.json({
          ...persona,
          ...(redirect ? { redirect } : {}),
        });
      }
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Production: Clerk auth ───
  const authz = req.headers.get("authorization");
  const hasBearer = !!authz?.toLowerCase().startsWith("bearer ");

  let userId: string | null = null;

  // --- MOBILE (Bearer token) ---
  if (hasBearer) {
    const token = authz!.slice(7);
    try {
      const verified = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      userId = verified.sub ?? null;
    } catch {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const me = await getCurrentUser(userId);
    if (!me) {
      return NextResponse.json(
        { success: false, error: { message: "No profile" } },
        { status: 404 }
      );
    }

    // Mobile contract
    return NextResponse.json({ success: true, data: me });
  }

  // --- WEB (cookie session) ---
  const a = await auth();
  userId = a.userId ?? null;

  if (!userId) {
    // Keep existing behavior your web code expects
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await getCurrentUser(userId);
  if (!me) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  const redirect = computeRedirect(me);

  // Web expects raw AppUser, but your useRoleRedirect also optionally reads json.redirect
  return NextResponse.json({ ...me, ...(redirect ? { redirect } : {}) });
}
