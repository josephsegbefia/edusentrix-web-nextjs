import { NextResponse, type NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformAssistedAccessSession } from "@/models/PlatformAssistedAccessSession";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformDelegation } from "@/lib/platform/auth/require-platform-delegation";
import { setAssistedAccessCookie } from "@/lib/platform/assisted-access/session";

const ALLOWED_DURATIONS = new Set([15, 30, 60, 120]);

function getClientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformUser();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim();
    const durationMinutes = Number(body?.durationMinutes || 30);

    if (reason.length < 10) {
      return NextResponse.json(
        { success: false, error: "Add a clear reason before starting assisted access." },
        { status: 400 }
      );
    }
    if (!ALLOWED_DURATIONS.has(durationMinutes)) {
      return NextResponse.json(
        { success: false, error: "Choose a valid assisted access duration." },
        { status: 400 }
      );
    }

    const schoolId = new mongoose.Types.ObjectId(id);
    const directAccess = hasPlatformPermission(
      gate.actor,
      "platform.schools.assistedAccess"
    );
    let delegatedGrantId: mongoose.Types.ObjectId | null = null;

    if (!directAccess) {
      const delegation = await requirePlatformDelegation({
        actor: gate.actor,
        schoolId,
        permission: "platform.schools.assistedAccess.delegated",
        scope: "school_assisted_admin_access",
      });
      if (!delegation.ok) {
        return NextResponse.json(
          { success: false, error: delegation.error },
          { status: delegation.status }
        );
      }
      delegatedGrantId = delegation.delegationId ?? null;
    }

    await connectToDatabase();
    const school = await School.findById(schoolId).select("_id name").lean();
    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);
    await PlatformAssistedAccessSession.updateMany(
      { actorUserId: gate.actor.userId, status: "active" },
      {
        $set: {
          status: "ended",
          endedAt: now,
          endedByUserId: gate.actor.userId,
          endReason: "superseded_by_new_assisted_access_session",
        },
      }
    );

    const session = await PlatformAssistedAccessSession.create({
      schoolId,
      actorUserId: gate.actor.userId,
      actorEmail: gate.actor.email,
      actorName: gate.actor.email,
      effectiveRole: "school_admin",
      reason,
      status: "active",
      startedAt: now,
      expiresAt,
      delegatedGrantId,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      schoolId,
      action: "platform.assisted_access.started",
      entityType: "PlatformAssistedAccessSession",
      entityId: session._id,
      metadata: {
        schoolName: school.name || null,
        durationMinutes,
        reason,
        delegatedGrantId: delegatedGrantId ? String(delegatedGrantId) : null,
      },
    });

    const response = NextResponse.json({
      success: true,
      data: {
        sessionId: String(session._id),
        schoolId: id,
        expiresAt: expiresAt.toISOString(),
        redirectTo: "/admin",
      },
    });
    setAssistedAccessCookie(response, String(session._id), expiresAt);
    return response;
  } catch (error) {
    console.error("Failed to start assisted access:", error);
    return NextResponse.json(
      { success: false, error: "Failed to start assisted access." },
      { status: 500 }
    );
  }
}
