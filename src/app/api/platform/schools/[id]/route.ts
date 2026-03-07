import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { getPlatformSchoolDetail } from "@/lib/platform-billing/platform-schools";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    const school = await getPlatformSchoolDetail(id);

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: school });
  } catch (error) {
    console.error("Failed to load platform school detail:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load platform school detail",
      },
      { status: 500 }
    );
  }
}
