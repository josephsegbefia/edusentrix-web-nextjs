import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { DELEGATION_REGISTRY } from "@/lib/delegations/registry";
import type { DelegationModule } from "@/lib/delegations/types";
import { requireSchoolAdminOrDelegatedPermission } from "@/lib/auth/requireSchoolAdminOrDelegatedPermission";
import { resolveSchoolActorContext } from "@/lib/auth/resolveSchoolActorContext";
import {
  findActiveDelegationIdForAnyPermission,
  mergedDelegationPermissions,
} from "@/lib/delegations/service";
import type { SchoolActorContext } from "@/lib/auth/resolveSchoolActorContext";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import {
  requireSchoolAdminOrTeacherRead,
  type SchoolStaffReadContext,
} from "@/lib/auth/requireSchoolAdminOrTeacherRead";

/** Returned when finance staff auth succeeds or a delegate satisfies module / permission checks. */
export type FinanceStaffOrDelegatedContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  /** Membership roles when `requireFinanceStaff` succeeded; empty for delegated-only access. */
  roles: string[];
  /** True when `requireFinanceStaff` succeeded (admin/bursar path). */
  isFinanceStaff: boolean;
  activeDelegationId: mongoose.Types.ObjectId | null;
};

/** School actor after a delegated permission check; includes delegation row id for audit. */
export type SchoolActorDelegationContext = SchoolActorContext & {
  activeDelegationId: mongoose.Types.ObjectId | null;
};

function viewerGatePermission(module: DelegationModule): string {
  const def = DELEGATION_REGISTRY[module];
  const viewer = def.presets.viewer ?? Object.values(def.presets)[0];
  const first = viewer?.permissions?.[0];
  if (!first) {
    throw new Error(`Delegation module ${module} has no preset permissions`);
  }
  return first;
}

/**
 * School admin always passes. Otherwise requires an implemented module and the
 * module’s viewer gate permission (first permission of the viewer preset).
 */
export async function requireSchoolAdminOrDelegatedModuleView(
  module: DelegationModule
): Promise<SchoolActorDelegationContext> {
  if (!DELEGATION_REGISTRY[module].implemented) {
    throw NextResponse.json(
      { success: false, error: "Module is not available for delegation." },
      { status: 403 }
    );
  }
  const permission = viewerGatePermission(module);
  const ctx = await resolveSchoolActorContext();
  const auth = await requireSchoolAdminOrDelegatedPermission({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
    permission,
  });
  return { ...ctx, activeDelegationId: auth.activeDelegationId };
}

/**
 * Same read surface as `requireSchoolAdminOrTeacherRead`, plus an active delegation
 * for the module’s viewer permission (e.g. timetable conflicts for delegates).
 */
export async function requireSchoolAdminOrTeacherReadOrDelegatedModuleView(
  module: DelegationModule
): Promise<SchoolStaffReadContext> {
  try {
    return await requireSchoolAdminOrTeacherRead();
  } catch (err) {
    if (!(err instanceof Response)) throw err;
  }
  const delegated = await requireSchoolAdminOrDelegatedModuleView(module);
  return {
    userId: delegated.userId,
    schoolId: delegated.schoolId,
    canBootstrapSchoolSettings: false,
  };
}

/**
 * School admin passes; delegate must have at least one of the listed permissions.
 */
export async function requireSchoolAdminOrDelegatedAnyPermission(
  permissions: string[]
): Promise<SchoolActorDelegationContext> {
  const ctx = await resolveSchoolActorContext();
  if (ctx.isSchoolAdmin) return { ...ctx, activeDelegationId: null };
  const merged = await mergedDelegationPermissions(ctx.schoolId, ctx.userId);
  if (!permissions.some((p) => merged.includes(p))) {
    throw NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const activeDelegationId = await findActiveDelegationIdForAnyPermission({
    schoolId: ctx.schoolId,
    staffUserId: ctx.userId,
    permissions,
  });
  return { ...ctx, activeDelegationId };
}

/**
 * Finance staff (school admin / bursar) or a user with any of the given delegated permissions.
 * Unauthenticated users still receive 401 from the delegation path.
 */
export async function requireFinanceStaffOrDelegatedAnyPermission(
  permissions: string[]
): Promise<FinanceStaffOrDelegatedContext> {
  try {
    const ctx = await requireFinanceStaff();
    return {
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      roles: ctx.roles,
      isFinanceStaff: true,
      activeDelegationId: null,
    };
  } catch (err) {
    if (!(err instanceof Response)) throw err;
  }
  const delegated = await requireSchoolAdminOrDelegatedAnyPermission(permissions);
  return {
    userId: delegated.userId,
    schoolId: delegated.schoolId,
    roles: [],
    isFinanceStaff: false,
    activeDelegationId: delegated.activeDelegationId,
  };
}

/** Finance staff (admin/bursar) or an active delegation for the module (e.g. supplies, students list). */
export async function requireFinanceStaffOrDelegatedModuleView(
  module: DelegationModule
): Promise<FinanceStaffOrDelegatedContext> {
  try {
    const ctx = await requireFinanceStaff();
    return {
      userId: ctx.userId,
      schoolId: ctx.schoolId,
      roles: ctx.roles,
      isFinanceStaff: true,
      activeDelegationId: null,
    };
  } catch (err) {
    if (!(err instanceof Response)) throw err;
  }
  const delegated = await requireSchoolAdminOrDelegatedModuleView(module);
  return {
    userId: delegated.userId,
    schoolId: delegated.schoolId,
    roles: [],
    isFinanceStaff: false,
    activeDelegationId: delegated.activeDelegationId,
  };
}
