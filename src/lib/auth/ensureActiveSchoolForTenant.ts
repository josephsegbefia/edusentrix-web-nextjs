import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";

type TenantSchoolGateMode = "api" | "page";

/**
 * Blocks tenant users when their school is suspended (`School.status === "deactivated"`).
 * Platform admins and other accounts without a school are unaffected at this layer.
 */
export async function ensureActiveSchoolForTenant(
  schoolId: Types.ObjectId,
  options: { mode: TenantSchoolGateMode }
): Promise<void> {
  await connectToDatabase();
  const doc = await School.findById(schoolId).select("status").lean<{
    status?: string;
  } | null>();

  if (doc?.status === "deactivated") {
    if (options.mode === "page") {
      redirect("/sign-in?error=school_disabled");
    }
    throw NextResponse.json(
      {
        error: "This school has been suspended. Contact your administrator.",
        code: "SCHOOL_SUSPENDED",
      },
      { status: 403 }
    );
  }
}
