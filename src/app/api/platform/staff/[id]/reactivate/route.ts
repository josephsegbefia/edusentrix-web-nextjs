import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { serializePlatformStaffProfile } from "@/lib/platform/staff/serialize-platform-staff";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

const ReactivateStaffSchema = z.object({
  reason: z.string().trim().min(8).max(1000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.staff.manageRoles");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid platform staff id." },
        { status: 400 }
      );
    }

    const parsed = ReactivateStaffSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Reactivation reason is required.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const profile = await PlatformStaffProfile.findById(id);
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Platform staff profile not found." },
        { status: 404 }
      );
    }

    profile.status = "active";
    profile.suspendedByUserId = null;
    profile.suspendedAt = null;
    profile.suspensionReason = null;
    await profile.save();

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      action: "platform.staff.reactivated",
      entityType: "PlatformStaffProfile",
      entityId: profile._id,
      metadata: {
        targetEmail: profile.email,
        reason: parsed.data.reason,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializePlatformStaffProfile(profile.toObject()),
    });
  } catch (error) {
    console.error("[platform/staff/[id]/reactivate:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to reactivate platform staff profile" },
      { status: 500 }
    );
  }
}
