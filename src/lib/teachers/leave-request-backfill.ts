/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { TeacherActivity } from "@/models/TeacherActivity";
import { pendingLeaveFilter } from "@/lib/teachers/leave-requests";

/**
 * Backfill of `leaveRequest` on pending leave rows created before the field existed.
 *
 * The requester is taken only from the `leave.submitted` audit record that the leave-request submit
 * route wrote in the same request as the rows. A row is matched only when exactly one such record has
 * the same teacher and school, covers the row's date, was written within `MATCH_WINDOW_MS` of the row,
 * and names a valid submitter. Every other row is left alone and stays attendance only.
 */

export const MATCH_WINDOW_MS = 2 * 60 * 1000;
export const BACKFILL_SOURCE = "backfill_leave_submitted" as const;

export type BackfillMatch = {
  attendanceId: string;
  activityId: string;
  submittedBy: string;
  submittedAt: string;
};

export type BackfillSkipReason = "no_audit_record" | "ambiguous" | "invalid_submitter";

export type BackfillPlan = {
  scanned: number;
  matched: BackfillMatch[];
  skipped: Record<BackfillSkipReason, number>;
};

/** Pending `on_leave` rows that carry no requester. */
function unrecordedPendingFilter(schoolId?: mongoose.Types.ObjectId): Record<string, unknown> {
  const pending = pendingLeaveFilter();
  delete pending["leaveRequest.submittedBy"];
  return {
    status: "on_leave",
    leaveRequest: { $exists: false },
    ...pending,
    ...(schoolId ? { schoolId } : {}),
  };
}

function submitterOf(activity: any): string | null {
  const fromCreatedBy = activity.createdBy ? String(activity.createdBy) : null;
  const fromMetadata = activity.metadata?.submittedBy ? String(activity.metadata.submittedBy) : null;
  if (fromCreatedBy && fromMetadata && fromCreatedBy !== fromMetadata) return null;
  const id = fromCreatedBy ?? fromMetadata;
  return id && mongoose.isValidObjectId(id) && /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
}

function coversDate(activity: any, date: Date): boolean {
  const start = activity.metadata?.startDate ? new Date(activity.metadata.startDate) : null;
  const end = activity.metadata?.endDate ? new Date(activity.metadata.endDate) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** Read-only. Lists what an apply would write and why other rows are skipped. */
export async function planLeaveRequestBackfill(
  options: { schoolId?: mongoose.Types.ObjectId } = {}
): Promise<BackfillPlan> {
  const plan: BackfillPlan = {
    scanned: 0,
    matched: [],
    skipped: { no_audit_record: 0, ambiguous: 0, invalid_submitter: 0 },
  };

  const rows: any[] = await TeacherAttendance.find(unrecordedPendingFilter(options.schoolId))
    .select("_id teacherId schoolId date createdAt")
    .lean();

  for (const row of rows) {
    plan.scanned += 1;
    if (!row.createdAt || !row.date) {
      plan.skipped.no_audit_record += 1;
      continue;
    }
    const created = new Date(row.createdAt).getTime();
    const activities: any[] = await TeacherActivity.find({
      teacherId: row.teacherId,
      schoolId: row.schoolId,
      type: "leave.submitted",
      createdAt: { $gte: new Date(created - MATCH_WINDOW_MS), $lte: new Date(created + MATCH_WINDOW_MS) },
    })
      .select("_id createdBy metadata createdAt")
      .lean();
    const covering = activities.filter((activity) => coversDate(activity, new Date(row.date)));

    if (covering.length === 0) {
      plan.skipped.no_audit_record += 1;
      continue;
    }
    if (covering.length > 1) {
      plan.skipped.ambiguous += 1;
      continue;
    }
    const activity = covering[0];
    const submittedBy = submitterOf(activity);
    if (!submittedBy) {
      plan.skipped.invalid_submitter += 1;
      continue;
    }
    plan.matched.push({
      attendanceId: String(row._id),
      activityId: String(activity._id),
      submittedBy,
      submittedAt: new Date(activity.createdAt).toISOString(),
    });
  }

  return plan;
}

/**
 * Writes `leaveRequest` for each match, only while the row is still pending and still has no requester.
 * Returns the matches that were written, for the rollback manifest.
 */
export async function applyLeaveRequestBackfill(matches: readonly BackfillMatch[]): Promise<BackfillMatch[]> {
  const written: BackfillMatch[] = [];
  for (const match of matches) {
    const result = await TeacherAttendance.updateOne(
      { _id: new mongoose.Types.ObjectId(match.attendanceId), ...unrecordedPendingFilter() },
      {
        $set: {
          leaveRequest: {
            submittedBy: new mongoose.Types.ObjectId(match.submittedBy),
            submittedAt: new Date(match.submittedAt),
            source: BACKFILL_SOURCE,
          },
        },
      }
    );
    if ((result.modifiedCount ?? 0) > 0) written.push(match);
  }
  return written;
}

/**
 * Removes only the `leaveRequest` values this backfill wrote, as listed in its manifest. Rows decided
 * since the backfill keep their requester, because the decision's maker-checker check relied on it.
 */
export async function rollbackLeaveRequestBackfill(
  manifest: readonly BackfillMatch[]
): Promise<{ restored: number; notRestored: number }> {
  let restored = 0;
  for (const entry of manifest) {
    const result = await TeacherAttendance.updateOne(
      {
        _id: new mongoose.Types.ObjectId(entry.attendanceId),
        "leaveRequest.source": BACKFILL_SOURCE,
        "leaveRequest.submittedBy": new mongoose.Types.ObjectId(entry.submittedBy),
        ...pendingLeaveFilter(),
      },
      { $unset: { leaveRequest: "" } }
    );
    restored += result.modifiedCount ?? 0;
  }
  return { restored, notRestored: manifest.length - restored };
}
