import "server-only";

import { redirect } from "next/navigation";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";

export async function assertActiveSchoolEnabled(schoolId: Types.ObjectId): Promise<void> {
  await connectToDatabase();
  const school = await School.findById(schoolId).select("status").lean<{ status?: string } | null>();
  if (school?.status === "deactivated") {
    redirect("/sign-in?error=school_disabled");
  }
}
