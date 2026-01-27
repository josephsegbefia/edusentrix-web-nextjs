import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export async function GET() {
  const { schoolId } = await requireSchoolAdmin();

  await connectToDatabase();
  const period = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  }).lean();
  return NextResponse.json({ success: true, data: period || null });
}
