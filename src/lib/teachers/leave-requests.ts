/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { Teacher } from "@/models/Teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { decisionError } from "@/lib/approvals/decision-guard";

/**
 * Teacher leave requests are `TeacherAttendance` rows with `status: "on_leave"`, one row per day.
 *
 * A decision is stored in `leaveDecision` (status, decider, time, reason). Older rows carry the
 * decision only as an `APPROVED:` / `REJECTED:` prefix in `notes`; the prefix is still written so
 * existing screens keep working, and it is still read for rows decided before `leaveDecision` existed.
 */

export type LeaveApprovalStatus = "pending" | "approved" | "rejected";
export type LeaveDecisionAction = "approve" | "reject";

const LEGACY_DECISION_PREFIX = /^(APPROVED|REJECTED):/;
const FORGED_PREFIX = /^\s*(APPROVED|REJECTED)\s*:/i;
const PENDING_MARKER = /^PENDING(?::\s*|\s*$)/;

export const LEAVE_REJECTION_REASON_MAX = 500;

/**
 * Rows that are leave requests: submitted through the leave-request route (`leaveRequest`), or
 * already decided. Routine attendance rows marked `on_leave` are excluded.
 */
export function leaveRequestScope(): Record<string, unknown> {
  return {
    $or: [
      { "leaveRequest.submittedBy": { $exists: true } },
      { "leaveDecision.status": { $exists: true } },
      { notes: LEGACY_DECISION_PREFIX },
    ],
  };
}

export function pendingLeaveFilter(): Record<string, unknown> {
  return {
    "leaveRequest.submittedBy": { $exists: true },
    "leaveDecision.status": { $exists: false },
    notes: { $not: LEGACY_DECISION_PREFIX },
  };
}

export function decidedLeaveFilter(status: "approved" | "rejected"): Record<string, unknown> {
  const prefix = status === "approved" ? /^APPROVED:/ : /^REJECTED:/;
  return {
    $or: [
      { "leaveDecision.status": status },
      { "leaveDecision.status": { $exists: false }, notes: prefix },
    ],
  };
}

export function leaveStatusFilter(status: string | null): Record<string, unknown> {
  if (status === "pending") return pendingLeaveFilter();
  if (status === "approved" || status === "rejected") return decidedLeaveFilter(status);
  return leaveRequestScope();
}

export function readLeaveApprovalStatus(row: { notes?: unknown; leaveDecision?: any }): LeaveApprovalStatus {
  const decided = row.leaveDecision?.status;
  if (decided === "approved" || decided === "rejected") {
    return decided;
  }
  const notes = typeof row.notes === "string" ? row.notes : "";
  if (notes.startsWith("APPROVED:")) return "approved";
  if (notes.startsWith("REJECTED:")) return "rejected";
  return "pending";
}

/** The notes a person wrote, without the decision prefix or the old `PENDING` marker. */
export function readableLeaveNotes(notes: unknown): string | null {
  if (typeof notes !== "string") return null;
  const text = notes
    .replace(/^(APPROVED|REJECTED):\s*/, "")
    .replace(PENDING_MARKER, "")
    .trim();
  return text || null;
}

/** True when free text would read as a decision. Decisions are only written by the decision routes. */
export function isForgedDecisionNote(notes: unknown): boolean {
  return typeof notes === "string" && FORGED_PREFIX.test(notes);
}

/**
 * Notes edited outside the decision routes keep an existing legacy decision prefix,
 * so an attendance edit cannot silently return a decided request to the queue.
 */
export function preserveLegacyDecisionPrefix(existingNotes: unknown, incoming: string | null | undefined) {
  if (incoming === undefined) return undefined;
  const existing = typeof existingNotes === "string" ? existingNotes : "";
  const match = existing.match(/^(APPROVED|REJECTED):/);
  if (!match) return incoming;
  const text = (incoming ?? "").trim();
  return text ? `${match[0]} ${text}` : `${match[0]} ${match[1] === "APPROVED" ? "Leave approved" : "Leave request rejected"}`;
}

/** Ids of the given teachers that belong to the school. */
export async function teachersInSchool(
  teacherIds: mongoose.Types.ObjectId[],
  schoolId: mongoose.Types.ObjectId
): Promise<Set<string>> {
  if (teacherIds.length === 0) return new Set();
  const rows = await Teacher.find({ _id: { $in: teacherIds }, schoolId }).select("_id").lean();
  return new Set(rows.map((row: any) => String(row._id)));
}

function personName(user: any): string | null {
  if (!user) return null;
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || null;
}

/**
 * Shared row shape for the school-wide list and the detail.
 * Email addresses are included only where existing Web screens already rely on them (the list).
 */
export function serializeLeaveRequest(
  r: any,
  options: { includeEmail?: boolean; decisionBlockedReason?: LeaveDecisionBlock | null } = {}
) {
  const withEmail = options.includeEmail === true;
  const teacher = r.teacherId && typeof r.teacherId === "object" && "_id" in r.teacherId ? r.teacherId : null;
  const user = teacher?.userId && typeof teacher.userId === "object" ? teacher.userId : null;
  const approvalStatus = readLeaveApprovalStatus(r);
  const decision = r.leaveDecision?.status ? r.leaveDecision : null;
  const decidedBy = decision?.decidedBy && typeof decision.decidedBy === "object" ? decision.decidedBy : null;
  const requestedBy =
    r.leaveRequest?.submittedBy && typeof r.leaveRequest.submittedBy === "object" && "_id" in r.leaveRequest.submittedBy
      ? r.leaveRequest.submittedBy
      : null;

  return {
    id: String(r._id),
    teacherId: teacher ? String(teacher._id) : r.teacherId ? String(r.teacherId) : null,
    teacher: teacher
      ? {
          id: String(teacher._id),
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          fullName: personName(user) || "",
          ...(withEmail ? { email: user?.email || null } : {}),
          department: teacher.department || null,
          photoUrl: user?.avatarUrl || null,
        }
      : null,
    date: new Date(r.date).toISOString(),
    leaveType: r.leaveType ?? null,
    reason: r.reason ?? null,
    notes: readableLeaveNotes(r.notes),
    approvalStatus,
    decision: decision
      ? {
          status: decision.status,
          decidedAt: decision.decidedAt ? new Date(decision.decidedAt).toISOString() : null,
          decidedByName: personName(decidedBy),
          rejectionReason: decision.reason || null,
        }
      : null,
    recordedBy: r.recordedBy
      ? {
          id: String(r.recordedBy._id),
          name: personName(r.recordedBy) || "",
          ...(withEmail ? { email: r.recordedBy.email || null } : {}),
        }
      : null,
    requestedBy: requestedBy ? { name: personName(requestedBy) || "" } : null,
    requestedAt: r.leaveRequest?.submittedAt ? new Date(r.leaveRequest.submittedAt).toISOString() : null,
    ...(options.decisionBlockedReason !== undefined
      ? { decisionBlockedReason: options.decisionBlockedReason }
      : {}),
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

export function leaveRequestPopulate(
  schoolId: mongoose.Types.ObjectId,
  options: { includeEmail?: boolean } = {}
) {
  const userFields = options.includeEmail ? "firstName lastName email" : "firstName lastName";
  return [
    {
      path: "teacherId",
      select: "userId department schoolId",
      match: { schoolId },
      populate: { path: "userId", select: `${userFields} avatarUrl` },
    },
    { path: "recordedBy", select: userFields },
    { path: "leaveRequest.submittedBy", select: "firstName lastName" },
    { path: "leaveDecision.decidedBy", select: "firstName lastName" },
  ];
}

/** Teacher records in this school that belong to the acting user (the leave beneficiary check). */
export async function actorTeacherIds(
  schoolId: mongoose.Types.ObjectId,
  actorUserId: unknown
): Promise<mongoose.Types.ObjectId[]> {
  if (!actorUserId || !mongoose.isValidObjectId(String(actorUserId))) return [];
  const rows = await Teacher.find({ schoolId, userId: new mongoose.Types.ObjectId(String(actorUserId)) })
    .select("_id")
    .lean();
  return rows.map((row: any) => row._id as mongoose.Types.ObjectId);
}

export type LeaveDecisionBlock = "not_a_request" | "maker_checker";

function refId(value: any): string | null {
  if (!value) return null;
  if (typeof value === "object" && "_id" in value) return value._id ? String(value._id) : null;
  return String(value);
}

/**
 * Why the actor may not decide this pending row, or null when they may. A row without a server-recorded
 * request is attendance, not an approval request. The requester and the beneficiary may not decide.
 */
export function leaveDecisionBlock(
  row: any,
  actorUserId: unknown,
  ownTeacherIds: readonly mongoose.Types.ObjectId[]
): LeaveDecisionBlock | null {
  if (readLeaveApprovalStatus(row) !== "pending") return null;
  const request = row.leaveRequest;
  // `submittedAt` is required, so a populated submitter whose user record is gone still counts as a request.
  if (!request || (!request.submittedBy && !request.submittedAt)) return "not_a_request";
  const submittedBy = refId(request.submittedBy);
  if (actorUserId && submittedBy === String(actorUserId)) return "maker_checker";
  const teacherId = refId(row.teacherId);
  if (teacherId && ownTeacherIds.some((id) => String(id) === teacherId)) return "maker_checker";
  return null;
}

export type LeaveDecisionResult =
  | { ok: true; id: string; approvalStatus: "approved" | "rejected"; decidedAt: Date }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: LeaveDecisionBlock }
  | { ok: false; reason: "stale"; approvalStatus: LeaveApprovalStatus };

/** The contract v2 error response for a refused leave decision. */
export function leaveDecisionFailure(
  result: Exclude<LeaveDecisionResult, { ok: true }>,
  leaveId: mongoose.Types.ObjectId
): Response {
  switch (result.reason) {
    case "not_found":
      return decisionError("not_found", "Leave request not found");
    case "not_a_request":
      return decisionError(
        "not_a_leave_request",
        "This day was recorded as attendance, not submitted as a leave request, so there is nothing to decide."
      );
    case "maker_checker":
      return decisionError(
        "maker_checker_required",
        "Another school administrator must decide this. You submitted this leave request or it is your own leave."
      );
    case "stale":
      return decisionError("stale_decision", "This leave request has already been decided.", {
        data: { id: String(leaveId), approvalStatus: result.approvalStatus },
      });
  }
}

/**
 * Decides one leave row with a single conditional write. The write matches only while the row
 * is still an undecided leave row in this school with the notes that were read, so at most one
 * concurrent decision succeeds. The activity record is written only by the winner.
 */
export async function decideLeaveRequest(args: {
  id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  actorUserId: unknown;
  action: LeaveDecisionAction;
  rejectionReason?: string;
}): Promise<LeaveDecisionResult> {
  const { id, schoolId, action } = args;
  const scope = { _id: id, schoolId, status: "on_leave" };

  const current: any = await TeacherAttendance.findOne(scope).lean();
  if (!current) {
    return { ok: false, reason: "not_found" };
  }
  const currentStatus = readLeaveApprovalStatus(current);
  if (currentStatus !== "pending") {
    return { ok: false, reason: "stale", approvalStatus: currentStatus };
  }
  const ownTeacherIds = await actorTeacherIds(schoolId, args.actorUserId);
  const block = leaveDecisionBlock(current, args.actorUserId, ownTeacherIds);
  if (block) {
    return { ok: false, reason: block };
  }

  const originalNotes: string | null = typeof current.notes === "string" ? current.notes : null;
  const readable = readableLeaveNotes(originalNotes);
  const decidedAt = new Date();
  const actorId = new mongoose.Types.ObjectId(String(args.actorUserId));
  const approvalStatus = action === "approve" ? "approved" : "rejected";

  const updated: any = await TeacherAttendance.findOneAndUpdate(
    {
      ...scope,
      "leaveDecision.status": { $exists: false },
      notes: originalNotes ?? null,
      "leaveRequest.submittedBy": { $exists: true, $ne: actorId },
      teacherId: { $nin: ownTeacherIds },
    },
    {
      $set: {
        notes:
          action === "approve"
            ? `APPROVED: ${readable || "Leave approved"}`
            : `REJECTED: ${readable || "Leave request rejected"}`,
        leaveDecision: {
          status: approvalStatus,
          decidedBy: actorId,
          decidedAt,
          ...(action === "reject" ? { reason: args.rejectionReason } : {}),
        },
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    const latest: any = await TeacherAttendance.findOne(scope).lean();
    if (!latest) {
      return { ok: false, reason: "not_found" };
    }
    const latestBlock = leaveDecisionBlock(latest, args.actorUserId, ownTeacherIds);
    if (latestBlock) {
      return { ok: false, reason: latestBlock };
    }
    return { ok: false, reason: "stale", approvalStatus: readLeaveApprovalStatus(latest) };
  }

  const day = new Date(updated.date);
  await logTeacherActivity({
    teacherId: String(updated.teacherId),
    schoolId,
    type: action === "approve" ? "leave.approved" : "leave.rejected",
    title: action === "approve" ? "Leave request approved" : "Leave request rejected",
    description:
      action === "approve"
        ? `Approved leave request for ${day.toLocaleDateString()}`
        : `Rejected leave request for ${day.toLocaleDateString()}: ${args.rejectionReason}`,
    metadata: {
      attendanceId: String(updated._id),
      date: day.toISOString(),
      leaveType: updated.leaveType,
      ...(action === "approve"
        ? { approvedBy: String(actorId) }
        : { rejectedBy: String(actorId), rejectionReason: args.rejectionReason }),
    },
    createdBy: actorId,
  });

  return { ok: true, id: String(updated._id), approvalStatus, decidedAt };
}
