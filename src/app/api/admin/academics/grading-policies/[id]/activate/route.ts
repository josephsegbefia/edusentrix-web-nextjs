import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { activateGradingPolicy } from "@/lib/academics/assessment-engine/grading-policy-service";

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
      return NextResponse.json({ success: false, error: "Invalid policy id" }, { status: 400 });
    }

    const result = await activateGradingPolicy({
      schoolId: toObjectId(schoolId),
      userId: toObjectId(userId),
      policyId: new mongoose.Types.ObjectId(id),
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

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Grading policy activate POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate grading policy" },
      { status: 500 }
    );
  }
}
