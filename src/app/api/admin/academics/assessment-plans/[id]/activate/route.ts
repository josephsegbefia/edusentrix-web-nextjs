import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { activateAssessmentPlan } from "@/lib/academics/assessment-engine/assessment-plan-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid plan id" }, { status: 400 });
    }

    const result = await activateAssessmentPlan({
      schoolId: toObjectId(schoolId),
      userId: toObjectId(userId),
      planId: new mongoose.Types.ObjectId(id),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...(result.errors ? { errors: result.errors } : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      archivedConflicts: result.archivedConflicts,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plan activate POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate assessment plan" },
      { status: 500 }
    );
  }
}
