import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { serializePlatformStaffProfile } from "@/lib/platform/staff/serialize-platform-staff";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.staff.read");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid platform staff id." },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const profile = await PlatformStaffProfile.findById(id).lean();
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Platform staff profile not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializePlatformStaffProfile(profile),
    });
  } catch (error) {
    console.error("[platform/staff/[id]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load platform staff profile" },
      { status: 500 }
    );
  }
}
