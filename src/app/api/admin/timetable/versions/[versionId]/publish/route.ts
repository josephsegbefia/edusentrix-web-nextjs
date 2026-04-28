import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import {
  TimetablePublishError,
  publishTimetableVersion,
} from "@/lib/timetable/publish";
import {
  isTimetableApiWriteEnabled,
  isTimetablePublishWorkflowEnabled,
} from "@/lib/timetable/feature-flags";
import { recordTimetableActivity } from "@/lib/timetable/audit";

function toObjectIdOrNull(value: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/timetable/versions/:versionId/publish
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }
    if (!isTimetablePublishWorkflowEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable publish workflow is disabled." },
        { status: 403 }
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

    const auditContext = buildSchoolUserAuditContext(req, {
      userId: userIdObj,
      schoolId: schoolIdObj,
      actorRole: "school_admin",
      idempotencyKey: resolveAuditIdempotencyKey(
        req,
        `timetable.publish:${String(versionObjId)}`
      ),
    });

    const summary = await publishTimetableVersion({
      schoolId: schoolIdObj,
      versionId: versionObjId,
      actorId: userIdObj,
      auditContext,
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.version.published",
      description: "Published timetable version",
      entityType: "TimetableVersion",
      entityId: versionObjId,
      metadata: summary,
    });

    if (summary.archivedVersionId) {
      await recordTimetableActivity({
        schoolId: schoolIdObj,
        userId: userIdObj,
        type: "timetable.version.archived",
        description: "Archived previous published timetable version",
        entityType: "TimetableVersion",
        entityId: new mongoose.Types.ObjectId(summary.archivedVersionId),
        metadata: {
          archivedVersionId: summary.archivedVersionId,
          publishedVersionId: summary.publishedVersionId,
          publishedAt: summary.publishedAt,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (e: unknown) {
    if (e instanceof TimetablePublishError) {
      return NextResponse.json(
        {
          success: false,
          error: e.message,
          code: e.code,
        },
        { status: e.status }
      );
    }
    console.error("Failed to publish timetable version:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to publish timetable version.",
        code: "TIMETABLE_PUBLISH_FAILED",
      },
      { status: 500 }
    );
  }
}
