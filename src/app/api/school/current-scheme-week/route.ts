import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { loadCurrentSchemeWeekForSchool } from "@/lib/schemes/load-current-scheme-week";

/**
 * GET /api/school/current-scheme-week
 * School-wide term week derived from the current academic period dates.
 */
export async function GET() {
  try {
    const active = await resolveActiveSchoolContext();
    if (!active.ok) {
      const status =
        active.reason === "unauthorized"
          ? 401
          : active.reason === "needs_school_selection"
            ? 409
            : 404;
      return NextResponse.json(
        {
          success: false,
          error:
            active.reason === "needs_school_selection"
              ? "School selection required"
              : "No school associated with user",
        },
        { status }
      );
    }

    await connectToDatabase();
    const data = await loadCurrentSchemeWeekForSchool(active.context.schoolId);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Failed to resolve current scheme week:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resolve current scheme week",
      },
      { status: 500 }
    );
  }
}
