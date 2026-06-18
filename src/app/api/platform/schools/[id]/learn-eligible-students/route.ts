import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getLearnEligibleStudentsSummary } from "@/lib/learn/grade-eligibility";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  await connectToDatabase();

  const summary = await getLearnEligibleStudentsSummary(new mongoose.Types.ObjectId(schoolId));

  return NextResponse.json({
    success: true,
    data: summary,
  });
}
