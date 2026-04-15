import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import { resolveDemoSessionFromCookie } from "@/lib/demo/session";

export async function GET() {
  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  await connectToDatabase();

  const session = await resolveDemoSessionFromCookie();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "No active demo session." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      sessionId: String(session._id),
      sandboxSchoolId: session.sandboxSchoolId
        ? String(session.sandboxSchoolId)
        : null,
      activePersonaRole: session.activePersonaRole,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      lastActiveAt: session.lastActiveAt,
    },
  });
}
