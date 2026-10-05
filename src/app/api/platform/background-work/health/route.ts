import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getBackgroundWorkHealth } from "@/lib/background/health";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.system.settings.read");
    if (!gate.ok) return gate.res;

    await connectToDatabase();
    const data = await getBackgroundWorkHealth();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load background work health:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load background work health" },
      { status: 500 }
    );
  }
}
