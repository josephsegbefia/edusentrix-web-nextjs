import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { getPlatformSchoolList } from "@/lib/platform-billing/platform-schools";

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const schools = await getPlatformSchoolList();
    return NextResponse.json({ success: true, data: { schools } });
  } catch (error) {
    console.error("Failed to load platform schools:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load platform schools",
      },
      { status: 500 }
    );
  }
}
