import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableChangeLog } from "@/models/TimetableChangeLog";
import { TimetableConflict } from "@/models/TimetableConflict";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";

type OfferingRow = {
  _id: Types.ObjectId;
  subjectId: Types.ObjectId;
};

type VersionRow = {
  _id: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  status: "draft" | "published";
};

function objectId(value: unknown): Types.ObjectId {
  if (value instanceof Types.ObjectId) return value;
  const stringValue = String(value ?? "");
  if (!Types.ObjectId.isValid(stringValue)) {
    throw new Error("Authenticated school or user id is invalid.");
  }
  return new Types.ObjectId(stringValue);
}

function uniqueObjectIds(values: Types.ObjectId[]): Types.ObjectId[] {
  return Array.from(new Set(values.map(String))).map((value) => new Types.ObjectId(value));
}

/**
 * Clear the active subject-offering setup for a school.
 *
 * Offerings and assignments are deactivated instead of deleted. Current-period
 * timetable versions and slots are archived/removed so the next timetable edit
 * starts clean, while historical documents and audit logs remain available.
 */
export async function POST(_req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();

    const schoolIdObj = objectId(schoolId);
    const actorId = objectId(userId);
    const activeOfferings = await SubjectOffering.find({
      schoolId: schoolIdObj,
      isActive: true,
    })
      .select("_id subjectId")
      .lean<OfferingRow[]>();

    const offeringIds = activeOfferings.map((offering) => offering._id);
    const subjectIds = uniqueObjectIds(activeOfferings.map((offering) => offering.subjectId));
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean();

    const currentPeriodId = currentPeriod?._id ?? null;
    const currentVersions = currentPeriodId && offeringIds.length > 0
      ? await TimetableVersion.find({
          schoolId: schoolIdObj,
          academicPeriodId: currentPeriodId,
          status: { $in: ["draft", "published"] },
        })
          .select("_id academicPeriodId status")
          .lean<VersionRow[]>()
      : [];
    const currentSlots = currentPeriodId && currentVersions.length > 0 && offeringIds.length > 0
      ? await TimetableSlot.find({
          schoolId: schoolIdObj,
          academicPeriodId: currentPeriodId,
          versionId: { $in: currentVersions.map((version) => version._id) },
          $or: [
            { subjectOfferingId: { $in: offeringIds } },
            { subjectId: { $in: subjectIds } },
          ],
        }).lean()
      : [];

    const session = await mongoose.startSession();
    let clearedClassGroups = 0;
    let deactivatedTeacherAssignments = 0;

    try {
      await session.withTransaction(async () => {
        if (offeringIds.length > 0) {
          await SubjectOffering.updateMany(
            { schoolId: schoolIdObj, _id: { $in: offeringIds }, isActive: true },
            { $set: { isActive: false } },
            { session }
          );

          const classGroupResult = await ClassGroup.updateMany(
            { schoolId: schoolIdObj },
            {
              $pull: {
                subjectOfferingIds: { $in: offeringIds },
                subjectIds: { $in: subjectIds },
              },
            },
            { session }
          );
          clearedClassGroups = classGroupResult.modifiedCount ?? 0;
        }

        if (currentPeriodId && offeringIds.length > 0) {
          const assignmentResult = await TeacherAssignment.updateMany(
            {
              schoolId: schoolIdObj,
              academicPeriodId: currentPeriodId,
              subjectOfferingId: { $in: offeringIds },
              status: "active",
            },
            { $set: { status: "inactive" } },
            { session }
          );
          deactivatedTeacherAssignments = assignmentResult.modifiedCount ?? 0;
        }

        if (currentSlots.length > 0 && currentPeriodId) {
          const slotIds = currentSlots.map((slot) => slot._id);
          await TimetableChangeLog.insertMany(
            currentSlots.map((slot) => ({
              schoolId: schoolIdObj,
              academicPeriodId: currentPeriodId,
              versionId: slot.versionId,
              action: "slot_deleted" as const,
              actorId,
              entityId: slot._id,
              before: {
                classGroupId: String(slot.classGroupId),
                subjectId: String(slot.subjectId),
                subjectOfferingId: slot.subjectOfferingId ? String(slot.subjectOfferingId) : null,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
              },
              after: null,
            })),
            { session }
          );
          await TimetableSlot.deleteMany(
            { _id: { $in: slotIds }, schoolId: schoolIdObj, academicPeriodId: currentPeriodId },
            { session }
          );
          await TimetableConflict.deleteMany(
            {
              schoolId: schoolIdObj,
              academicPeriodId: currentPeriodId,
              $or: [
                { slotIds: { $in: slotIds } },
                { versionId: { $in: currentVersions.map((version) => version._id) } },
              ],
            },
            { session }
          );
        }

        if (currentVersions.length > 0 && currentPeriodId) {
          const now = new Date();
          await TimetableVersion.updateMany(
            {
              schoolId: schoolIdObj,
              academicPeriodId: currentPeriodId,
              status: { $in: ["draft", "published"] },
            },
            {
              $set: {
                status: "archived",
                stale: true,
                updatedBy: actorId,
              },
              $inc: { lockVersion: 1 },
              $push: {
                staleReasons: {
                  sourceModule: "subjectOffering",
                  sourceEntityId: null,
                  message: "Subject offering setup was cleared; the timetable must be rebuilt.",
                  createdAt: now,
                },
              },
            },
            { session }
          );
          await TimetableChangeLog.insertMany(
            currentVersions.map((version) => ({
              schoolId: schoolIdObj,
              academicPeriodId: currentPeriodId,
              versionId: version._id,
              action: "archived" as const,
              actorId,
              entityId: version._id,
              before: { status: version.status },
              after: { status: "archived", reason: "subject_offering_setup_cleared" },
            })),
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      data: {
        deactivatedOfferings: offeringIds.length,
        clearedClassGroups,
        deactivatedTeacherAssignments,
        clearedTimetableSlots: currentSlots.length,
        archivedTimetableVersions: currentVersions.length,
        academicPeriod: currentPeriod
          ? { yearLabel: currentPeriod.yearLabel, term: currentPeriod.term }
          : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to clear subject offering setup";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
