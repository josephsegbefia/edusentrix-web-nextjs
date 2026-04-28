// src/app/api/admin/admissions/cycles/[cycleId]/analytics/route.ts
// GET — analytics snapshot for a single admissions cycle.
// Returns: funnel, by status, by channel, by grade (with capacity),
// decision velocity, fee summary and weekly counters.
//
// Powers the Analytics tab in the cycle workspace. See:
// docs/ADMISSIONS_ROADMAP.md (Phase 5 — analytics).

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { buildCycleAnalyticsSnapshot } from "@/lib/admissions/analytics";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

type Params = { cycleId: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
    await connectToDatabase();
    const { cycleId } = await params;

    if (!mongoose.Types.ObjectId.isValid(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }

    const cycleObjectId = new mongoose.Types.ObjectId(cycleId);
    const cycleExists = await AdmissionCycle.exists({
      _id: cycleObjectId,
      schoolId: ctx.schoolId,
    });
    if (!cycleExists) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const snapshot = await buildCycleAnalyticsSnapshot({
      schoolId: ctx.schoolId,
      cycleId: cycleObjectId,
    });

    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin admissions analytics GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}
