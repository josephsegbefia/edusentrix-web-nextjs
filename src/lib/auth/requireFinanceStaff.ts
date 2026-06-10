// src/lib/auth/requireFinanceStaff.ts
import "server-only";
import type { IUser } from "@/models/User";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { gateFinanceStaffRoles } from "@/lib/auth/role-gates";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { assertActiveSchoolEnabled } from "@/lib/auth/assert-active-school-enabled";

type FinanceStaffContext = {
  userId: NonNullable<IUser["_id"]>;
  schoolId: NonNullable<IUser["schoolId"]>;
  roles: string[];
};

type RequireFinanceStaffOptions = {
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

export async function requireFinanceStaff(
  options: RequireFinanceStaffOptions = {}
): Promise<FinanceStaffContext> {
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
  const financeGate = gateFinanceStaffRoles(roles);
  if (!financeGate.ok) {
    handleFailure(mode, financeGate.status, financeGate.error);
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
