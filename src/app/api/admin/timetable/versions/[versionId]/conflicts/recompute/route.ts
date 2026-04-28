import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { TimetableVersion } from "@/models/TimetableVersion";
import { recomputeConflictsForVersion } from "@/lib/timetable/recompute-conflicts";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";
import { recordTimetableActivity } from "@/lib/timetable/audit";

function toObjectIdOrNull(value: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/timetable/versions/:versionId/conflicts/recompute
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ versionId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "timetable.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const { versionId } = await ctx.params;
    const versionObjId = toObjectIdOrNull(versionId);
    if (!versionObjId) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const versionExists = await TimetableVersion.exists({
      _id: versionObjId,
      schoolId: schoolIdObj,
    });
    if (!versionExists) {
      return NextResponse.json(
        { success: false, error: "Timetable version not found for school." },
        { status: 404 }
      );
    }

    const summary = await recomputeConflictsForVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.conflicts.recomputed",
      description: "Recomputed timetable conflicts",
      entityType: "TimetableVersion",
      entityId: versionObjId,
      metadata: summary,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (e: unknown) {
    console.error("Failed to recompute timetable conflicts:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to recompute timetable conflicts.",
      },
      { status: 500 }
    );
  }
}
