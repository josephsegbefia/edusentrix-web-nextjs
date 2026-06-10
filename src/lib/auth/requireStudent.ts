import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import type { MembershipRole } from "@/lib/roles";
import { gateStudentApiAccess } from "@/lib/auth/role-gates";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { assertActiveSchoolEnabled } from "@/lib/auth/assert-active-school-enabled";

export interface StudentContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: MembershipRole[];
}

type RequireStudentOptions = {
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

export async function requireStudent(
  options: RequireStudentOptions = {}
): Promise<StudentContext> {
  const { mode = "api" } = options;

  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    handleFailure(
      mode,
      active.reason === "needs_school_selection"
        ? 409
        : active.reason === "unauthorized"
          ? 401
          : 403,
      active.reason === "needs_school_selection"
        ? "School selection required"
        : "Unauthorized"
    );
  }

  const roles = active.context.roles;
  const studentGate = gateStudentApiAccess(roles);
  if (!studentGate.ok) {
    handleFailure(mode, studentGate.status, studentGate.error);
  }

  if (mode === "page") {
    await assertActiveSchoolEnabled(active.context.schoolId);
  }

  return {
    userId: active.context.userId,
    schoolId: active.context.schoolId,
    roles,
  };
}
