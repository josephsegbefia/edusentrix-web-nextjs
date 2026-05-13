import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { serializePlatformDelegation } from "@/lib/platform/delegations/serialize-platform-delegation";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformDelegation } from "@/models/PlatformDelegation";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { School } from "@/models/School";

const RevokeDelegationSchema = z.object({
  reason: z.string().trim().min(8).max(1000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.implementation.assignTasks");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid delegation id" }, { status: 400 });
    }

    const parsed = RevokeDelegationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Revocation reason is required.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const delegation = await PlatformDelegation.findById(id);
    if (!delegation) {
      return NextResponse.json({ success: false, error: "Delegation not found" }, { status: 404 });
    }

    delegation.status = "revoked";
    delegation.revokedAt = new Date();
    delegation.revokedByUserId = gate.actor.userId;
    delegation.revokeReason = parsed.data.reason;
    await delegation.save();

    const [school, staffProfile] = await Promise.all([
      delegation.schoolId
        ? School.findById(delegation.schoolId).select("name").lean<{ _id: unknown; name?: string } | null>()
        : null,
      delegation.staffProfileId
        ? PlatformStaffProfile.findById(delegation.staffProfileId)
            .select("fullName email")
            .lean<{ _id: unknown; fullName: string; email: string } | null>()
        : null,
    ]);

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      schoolId: delegation.schoolId || null,
      action: "platform.delegation.revoked",
      entityType: "PlatformDelegation",
      entityId: delegation._id,
      metadata: {
        staffProfileId: delegation.staffProfileId ? String(delegation.staffProfileId) : null,
        staffEmail: staffProfile?.email || null,
        schoolName: school?.name || null,
        scope: delegation.scope,
        reason: parsed.data.reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        delegation: serializePlatformDelegation(delegation.toObject(), {
          schoolName: school?.name || null,
          staffName: staffProfile?.fullName || "Unknown staff",
          staffEmail: staffProfile?.email || "",
        }),
      },
    });
  } catch (error) {
    console.error("[platform/delegations/[id]/revoke:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke platform delegation" },
      { status: 500 }
    );
  }
}
