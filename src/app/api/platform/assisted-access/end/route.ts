import { NextResponse } from "next/server";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformAssistedAccessSession } from "@/models/PlatformAssistedAccessSession";
import {
  clearAssistedAccessCookie,
  getActiveAssistedAccessSession,
} from "@/lib/platform/assisted-access/session";

export async function POST(req: Request) {
  try {
    const active = await getActiveAssistedAccessSession();
    if (!active) {
      const response = NextResponse.json({
        success: true,
        data: { ended: false, redirectTo: "/platform/schools" },
      });
      clearAssistedAccessCookie(response);
      return response;
    }

    const body = await req.json().catch(() => ({}));
    const endReason = String(body?.reason || "ended_by_actor").trim();
    const now = new Date();

    await PlatformAssistedAccessSession.updateOne(
      { _id: active.sessionId, status: "active" },
      {
        $set: {
          status: "ended",
          endedAt: now,
          endedByUserId: active.actorUserId,
          endReason,
        },
      }
    );

    await PlatformAuditLog.create({
      actorId: active.actorUserId,
      schoolId: active.schoolId,
      action: "platform.assisted_access.ended",
      entityType: "PlatformAssistedAccessSession",
      entityId: active.sessionId,
      metadata: {
        schoolName: active.schoolName,
        reason: endReason,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        ended: true,
        schoolId: String(active.schoolId),
        redirectTo: `/platform/schools/${active.schoolId}`,
      },
    });
    clearAssistedAccessCookie(response);
    return response;
  } catch (error) {
    console.error("Failed to end assisted access:", error);
    return NextResponse.json(
      { success: false, error: "Failed to end assisted access." },
      { status: 500 }
    );
  }
}
