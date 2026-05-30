import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { buildParentWardsAcademicsSummary } from "@/lib/academics/profile/build-parent-wards-academics-summary";

/**
 * Multi-ward academic summary for parent dashboard (profile-first).
 */
export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId") || searchParams.get("termId");

    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return Response.json({ success: false, error: "Invalid periodId" }, { status: 400 });
    }

    const data = await buildParentWardsAcademicsSummary({
      context,
      periodId,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to fetch parent academics:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch academics";

    if (message === "Academic period not found") {
      return Response.json({ success: false, error: message }, { status: 404 });
    }

    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
