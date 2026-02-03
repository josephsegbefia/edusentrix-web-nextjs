import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { fetchEligibleEditors } from "@/lib/academic-calendar/editors";

export async function GET() {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectToDatabase();
  const data = await fetchEligibleEditors(context.schoolId);

  return NextResponse.json({ success: true, data });
}
