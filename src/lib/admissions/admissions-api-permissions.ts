import { NextResponse } from "next/server";
import type { AdmissionsManagerContext } from "@/lib/auth/requireAdmissionsManager";

/** Server-side check: school admins bypass; delegates need the exact permission string. */
export function requireAdmissionsPermission(
  ctx: AdmissionsManagerContext,
  permission: string
): void {
  if (ctx.isAdmin) return;
  if (!ctx.admissionsPermissions.includes(permission)) {
    throw NextResponse.json(
      { success: false, error: "You do not have permission for this action" },
      { status: 403 }
    );
  }
}

type ApplicationPatchFields = {
  status?: string;
  assignedReviewerId?: string | null;
  notesPrivate?: string | null;
  feeStatus?: string;
  interviewAt?: string | null;
  interviewEndsAt?: string | null;
};

/** Enforce preset permissions for PATCH /applications/[id] body (after Zod parse). */
export function enforceApplicationPatchPermissions(
  ctx: AdmissionsManagerContext,
  patch: ApplicationPatchFields
): void {
  if (patch.status !== undefined) {
    requireAdmissionsPermission(ctx, "admissions.change_status");
  }
  if (patch.assignedReviewerId !== undefined) {
    requireAdmissionsPermission(ctx, "admissions.change_status");
  }
  if (patch.notesPrivate !== undefined) {
    requireAdmissionsPermission(ctx, "admissions.comment");
  }
  if (patch.feeStatus !== undefined) {
    requireAdmissionsPermission(ctx, "admissions.request_payment");
  }
  if (patch.interviewAt !== undefined || patch.interviewEndsAt !== undefined) {
    requireAdmissionsPermission(ctx, "admissions.schedule_interview");
  }
}
