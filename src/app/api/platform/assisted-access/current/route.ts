import { NextResponse } from "next/server";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

export async function GET() {
  try {
    const active = await getActiveAssistedAccessSession();
    if (!active) {
      return NextResponse.json({ success: true, data: { active: false } });
    }

    return NextResponse.json({
      success: true,
      data: {
        active: true,
        sessionId: active.sessionId,
        schoolId: String(active.schoolId),
        schoolName: active.schoolName,
        actorEmail: active.actorEmail,
        actorName: active.actorName,
        reason: active.reason,
        startedAt: active.startedAt.toISOString(),
        expiresAt: active.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to load assisted access session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load assisted access session." },
      { status: 500 }
    );
  }
}
