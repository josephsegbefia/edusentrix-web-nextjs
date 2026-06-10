import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

export type SchoolActorContext = {
  userId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  isSchoolAdmin: boolean;
};

/**
 * Clerk user + school membership, with `isSchoolAdmin` from membership roles.
 * Used by delegated module routes and meetings helpers.
 */
export async function resolveSchoolActorContext(): Promise<SchoolActorContext> {
  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = active.context.roles;
  const adminGate = gateSchoolAdminRoles(roles);
  if (adminGate.ok) {
    return { userId: active.context.userId, schoolId: active.context.schoolId, isSchoolAdmin: true };
  }

  return { userId: active.context.userId, schoolId: active.context.schoolId, isSchoolAdmin: false };
}
