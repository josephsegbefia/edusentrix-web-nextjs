import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
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
 * POST /api/admin/timetable/versions/:versionId/clone-from-published
 * Clone currently published slots for the same school+period into the target draft version.
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

    const targetVersionId = toObjectIdOrNull(versionId);
    if (!targetVersionId) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const targetVersion = await TimetableVersion.findOne({
      _id: targetVersionId,
      schoolId: schoolIdObj,
    });
    if (!targetVersion) {
      return NextResponse.json(
        { success: false, error: "Target version not found for school." },
        { status: 404 }
      );
    }

    if (targetVersion.status !== "draft") {
      return NextResponse.json(
        { success: false, error: "Only draft versions can be cloned into." },
        { status: 409 }
      );
    }

    const sourceVersion = await TimetableVersion.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: targetVersion.academicPeriodId,
      status: "published",
    })
      .select("_id")
      .lean();

    if (!sourceVersion) {
      return NextResponse.json(
        { success: false, error: "No published version found for this academic period." },
        { status: 404 }
      );
    }

    const sourceVersionId = (sourceVersion as { _id: mongoose.Types.ObjectId })._id;
    const sourceSlots = await TimetableSlot.find({ versionId: sourceVersionId }).lean();

    await TimetableSlot.deleteMany({ versionId: targetVersionId });

    if ((sourceSlots || []).length > 0) {
      const now = new Date();
      await TimetableSlot.insertMany(
        sourceSlots.map((slot) => ({
          schoolId: slot.schoolId,
          academicPeriodId: slot.academicPeriodId,
          versionId: targetVersionId,
          classGroupId: slot.classGroupId,
          gradeId: slot.gradeId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classroomLabel: slot.classroomLabel,
          source: slot.source,
          createdBy: userIdObj,
          updatedBy: userIdObj,
          createdAt: now,
          updatedAt: now,
        }))
      );
    }

    await TimetableVersion.updateOne(
      { _id: targetVersionId },
      {
        $set: {
          baseVersionId: sourceVersionId,
          updatedBy: userIdObj,
        },
        $inc: { lockVersion: 1 },
      }
    );

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.version.cloned_from_published",
      description: "Cloned draft timetable from published version",
      entityType: "TimetableVersion",
      entityId: targetVersionId,
      metadata: {
        sourceVersionId: String(sourceVersionId),
        clonedSlotCount: sourceSlots.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        targetVersionId: String(targetVersionId),
        sourceVersionId: String(sourceVersionId),
        clonedSlotCount: sourceSlots.length,
      },
    });
  } catch (e: unknown) {
    console.error("Failed to clone from published timetable:", e);
    const message =
      e instanceof Error ? e.message : "Failed to clone from published version.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
