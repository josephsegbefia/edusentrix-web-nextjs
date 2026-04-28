import { NextResponse } from "next/server";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import type { MeetingsCapabilities } from "@/lib/meetings/meetings-capabilities";
import {
  resolveSchoolActorContext,
  type SchoolActorContext,
} from "@/lib/auth/resolveSchoolActorContext";

export type MeetingsApiContext = SchoolActorContext;

export async function resolveMeetingsCapabilities(
  ctx: MeetingsApiContext
): Promise<MeetingsCapabilities> {
  if (ctx.isSchoolAdmin) {
    return {
      isSchoolAdmin: true,
      canCreate: true,
      canInvite: true,
      canCancel: true,
      canEdit: true,
      canStart: true,
    };
  }
  const p = await mergedDelegationPermissions(ctx.schoolId, ctx.userId);
  return {
    isSchoolAdmin: false,
    canCreate: p.includes("meetings.create"),
    canInvite: p.includes("meetings.invite") || p.includes("meetings.create"),
    canCancel: p.includes("meetings.cancel"),
    canEdit: p.includes("meetings.edit"),
    canStart: p.includes("meetings.start"),
  };
}

/** School admins pass; others need the exact delegation permission. */
export async function requireMeetingsPermission(
  permission: string
): Promise<MeetingsApiContext> {
  const ctx = await resolveSchoolActorContext();
  if (ctx.isSchoolAdmin) {
    return ctx;
  }
  const permissions = await mergedDelegationPermissions(ctx.schoolId, ctx.userId);
  if (!permissions.includes(permission)) {
    throw NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return ctx;
}

/** School admins pass; others need at least one of the listed permissions. */
export async function requireMeetingsAnyPermission(
  anyOf: string[]
): Promise<MeetingsApiContext> {
  const ctx = await resolveSchoolActorContext();
  if (ctx.isSchoolAdmin) {
    return ctx;
  }
  const permissions = await mergedDelegationPermissions(ctx.schoolId, ctx.userId);
  if (!anyOf.some((p) => permissions.includes(p))) {
    throw NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return ctx;
}

export type { MeetingsCapabilities } from "@/lib/meetings/meetings-capabilities";
