import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { serializePlatformStaffProfile } from "@/lib/platform/staff/serialize-platform-staff";
import { PlatformAuditLog } from "@/models/PlatformAuditLog";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

const SuspendStaffSchema = z.object({
  reason: z.string().trim().min(8).max(1000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.staff.suspend");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid platform staff id." },
        { status: 400 }
      );
    }

    const parsed = SuspendStaffSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Suspension reason is required.", details: parsed.error.flatten() },
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

    if (String(profile.userId) === String(gate.actor.userId)) {
      return NextResponse.json(
        { success: false, error: "You cannot suspend your own platform staff profile." },
        { status: 400 }
      );
    }

    profile.status = "suspended";
    profile.suspendedByUserId = gate.actor.userId;
    profile.suspendedAt = new Date();
    profile.suspensionReason = parsed.data.reason;
    await profile.save();

    await PlatformAuditLog.create({
      actorId: gate.actor.userId,
      action: "platform.staff.suspended",
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
    console.error("[platform/staff/[id]/suspend:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to suspend platform staff profile" },
      { status: 500 }
    );
  }
}
