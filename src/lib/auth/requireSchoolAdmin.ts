import type { IUser } from "@/models/User";
import { NextResponse } from "next/server";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

type SchoolAdminContext = {
  userId: NonNullable<IUser["_id"]>;
  schoolId: NonNullable<IUser["schoolId"]>;
};

export async function requireSchoolAdmin(): Promise<SchoolAdminContext> {
  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "unauthorized") {
      throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminGate = gateSchoolAdminRoles(active.context.roles);
  if (!adminGate.ok) {
    throw NextResponse.json({ error: adminGate.error }, { status: adminGate.status });
  }

  return { userId: active.context.userId, schoolId: active.context.schoolId };
}
