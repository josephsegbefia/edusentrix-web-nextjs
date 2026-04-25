import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getLeoPlatformConfig, upsertLeoPlatformFlag } from "@/lib/leo/platform-flag";
import { isLeoCopilotServerRuntimeEnabled } from "@/lib/leo/runtime";
import { LEO_FEATURE_FLAG_KEY } from "@/lib/leo/types";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  defaultState: z.enum(["enabled", "disabled"]).optional(),
  forcedMode: z.enum(["none", "force_enabled", "force_disabled"]).optional(),
  allowSchoolOverride: z.boolean().optional(),
  allowSchoolSelfService: z.boolean().optional(),
  rolloutNotes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;
    await connectToDatabase();
    const platform = await getLeoPlatformConfig();
    return NextResponse.json({
      success: true,
      data: {
        key: LEO_FEATURE_FLAG_KEY,
        runtimeServer: isLeoCopilotServerRuntimeEnabled(),
        platform,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Platform Leo settings GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Leo platform settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;
    const body = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const updatedBy = gate.me?._id
      ? new mongoose.Types.ObjectId(String(gate.me._id))
      : null;
    await upsertLeoPlatformFlag(parsed.data, updatedBy);
    const platform = await getLeoPlatformConfig();
    return NextResponse.json({
      success: true,
      data: { platform, key: LEO_FEATURE_FLAG_KEY, runtimeServer: isLeoCopilotServerRuntimeEnabled() },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Platform Leo settings PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Leo platform settings" },
      { status: 500 }
    );
  }
}
