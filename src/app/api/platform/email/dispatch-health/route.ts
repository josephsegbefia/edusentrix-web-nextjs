import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { getEmailDispatchHealth } from "@/lib/email/dispatch-health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requirePlatformPermission("platform.system.settings.read");
    if (!gate.ok) return gate.res;

    await connectToDatabase();
    const data = await getEmailDispatchHealth();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to load email dispatch health:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load email dispatch health",
      },
      { status: 500 }
    );
  }
}
