import mongoose from "mongoose";
import type { ISchemeOfWork } from "@/models/SchemeOfWork";

function idsEqual(
  a: mongoose.Types.ObjectId | null | undefined,
  b: mongoose.Types.ObjectId | null | undefined
): boolean {
  if (!a || !b) return false;
  return String(a) === String(b);
}

/** Same visibility rules as lesson-note scheme linking: approved/active for all; draft/in_review for owner. */
export function teacherMayViewScheme(
  scheme: Pick<ISchemeOfWork, "status" | "ownerTeacherId">,
  teacherId: mongoose.Types.ObjectId
): boolean {
  const status = scheme.status;
  if (status === "active" || status === "approved") return true;
  if (status === "draft" || status === "in_review") {
    return scheme.ownerTeacherId ? idsEqual(scheme.ownerTeacherId, teacherId) : false;
  }
  return false;
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
