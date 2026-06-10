import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { Guardian } from "@/models/Guardian";
import type { MembershipRole } from "@/lib/roles";
import { gateParentApiAccess } from "@/lib/auth/role-gates";
import { assertActiveSchoolEnabled } from "@/lib/auth/assert-active-school-enabled";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

export interface ParentContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
  isAdmin: boolean;
}

type RequireParentOptions = {
  mode?: "api" | "page";
};

function handleFailure(
  mode: "api" | "page",
  status: number,
  message: string
): never {
  if (mode === "page") {
    if (status === 401) redirect("/sign-in");
    if (status === 409) redirect("/auth/switch");
    redirect("/dashboard");
  }
  throw NextResponse.json({ error: message }, { status });
}

/**
 * Require the current user to be an authenticated parent.
 * Used for parent-specific API routes and pages.
 */
export async function requireParent(
  options: RequireParentOptions = {}
): Promise<ParentContext> {
  const { mode = "api" } = options;

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    handleFailure(
      mode,
      active.reason === "needs_school_selection" ? 409 : active.reason === "unauthorized" ? 401 : 403,
      active.reason === "needs_school_selection" ? "School selection required" : "Unauthorized"
    );
  }

  const roles = active.context.roles;
  const isAdmin = roles.includes("school_admin");
  const parentGate = gateParentApiAccess(roles);
  if (!parentGate.ok) {
    handleFailure(mode, parentGate.status, parentGate.error);
  }

  if (mode === "page") {
    await assertActiveSchoolEnabled(active.context.schoolId);
  }

  return {
    userId: active.context.userId,
    schoolId: active.context.schoolId,
    roles,
    isAdmin,
  };
}

/**
 * Verify that a parent has guardian access to a specific student.
 * Throws 403 if the parent is not linked to the student via Guardian model.
 */
export async function verifyGuardianAccess(
  parentUserId: Types.ObjectId,
  studentId: string,
  options: { mode?: "api" | "page" } = {}
): Promise<{ guardianId: Types.ObjectId; isPrimary: boolean }> {
  const { mode = "api" } = options;

  const guardian = await Guardian.findOne({
    userId: parentUserId,
    studentId: new Types.ObjectId(studentId),
  })
    .select("_id isPrimary")
    .lean();

  if (!guardian) {
    if (mode === "page") {
      redirect("/parent");
    }
    throw NextResponse.json(
      { error: "You do not have access to this student" },
      { status: 403 }
    );
  }

  return {
    guardianId: (guardian as { _id: Types.ObjectId })._id,
    isPrimary: (guardian as { isPrimary: boolean }).isPrimary,
  };
}

/**
 * Get all student IDs that a parent has guardian access to.
 */
export async function getParentWardIds(
  parentUserId: Types.ObjectId
): Promise<Types.ObjectId[]> {
  const guardians = await Guardian.find({ userId: parentUserId })
    .select("studentId")
    .lean();

  return guardians.map(
    (g) => (g as { studentId: Types.ObjectId }).studentId
  );
}
