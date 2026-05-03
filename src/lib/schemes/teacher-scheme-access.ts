import mongoose from "mongoose";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";

function idsEqual(
  a: mongoose.Types.ObjectId | null | undefined,
  b: mongoose.Types.ObjectId | null | undefined
): boolean {
  if (!a || !b) return false;
  return String(a) === String(b);
}

/** Same visibility rules as lesson-note scheme linking: approved/active for all; work-in-progress for owner. */
export function teacherMayViewScheme(
  scheme: Pick<ISchemeOfWork, "status" | "ownerTeacherId">,
  teacherId: mongoose.Types.ObjectId
): boolean {
  const status = scheme.status;
  if (status === "active" || status === "approved") return true;
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "needs_revision" ||
    status === "rejected"
  ) {
    return scheme.ownerTeacherId ? idsEqual(scheme.ownerTeacherId, teacherId) : false;
  }
  return false;
}

export function teacherMayEditScheme(
  scheme: Pick<ISchemeOfWork, "ownerTeacherId" | "schoolId">,
  ctx: {
    schoolId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    isAdmin: boolean;
  }
): boolean {
  if (String(scheme.schoolId) !== String(ctx.schoolId)) return false;
  if (ctx.isAdmin) return true;
  return idsEqual(scheme.ownerTeacherId, ctx.teacherId);
}

export function teacherMayUpdateSchemeCoverage(
  scheme: Pick<ISchemeOfWork, "status" | "ownerTeacherId" | "schoolId">,
  ctx: {
    schoolId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    isAdmin: boolean;
  }
): boolean {
  if (String(scheme.schoolId) !== String(ctx.schoolId)) return false;
  if (scheme.status !== "approved" && scheme.status !== "active") return false;
  if (ctx.isAdmin) return true;
  if (!scheme.ownerTeacherId) return true;
  return idsEqual(scheme.ownerTeacherId, ctx.teacherId);
}

/** Drafts and resubmission states only; blocks submitted/approved/active/archived. */
export function teacherMayDeleteScheme(
  scheme: Pick<ISchemeOfWork, "status" | "ownerTeacherId" | "schoolId">,
  ctx: {
    schoolId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    isAdmin: boolean;
  }
): boolean {
  if (String(scheme.schoolId) !== String(ctx.schoolId)) return false;
  if (!["draft", "needs_revision", "rejected"].includes(scheme.status)) return false;
  if (ctx.isAdmin) return true;
  if (!scheme.ownerTeacherId) return false;
  return idsEqual(scheme.ownerTeacherId, ctx.teacherId);
}
