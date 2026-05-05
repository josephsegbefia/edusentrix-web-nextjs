import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { School } from "@/models/School";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id: schoolIdParam } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(schoolIdParam)) {
      return NextResponse.json({ success: false, error: "Invalid school id" }, { status: 400 });
    }
    const schoolId = new mongoose.Types.ObjectId(schoolIdParam);

    await connectToDatabase();
    const updated = await School.findOneAndUpdate(
      { _id: schoolId, status: "deactivated" },
      { $set: { status: "active" } },
      { new: true }
    )
      .select("_id status")
      .lean();

    if (!updated) {
      const exists = await School.findById(schoolId).select("status").lean();
      if (!exists) {
        return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
      }
      return NextResponse.json(
        {
          success: false,
          error: "School is not suspended. Only deactivated schools can be reactivated this way.",
          code: "NOT_SUSPENDED",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { schoolId: schoolIdParam, status: updated.status },
    });
  } catch (error) {
    console.error("platform school activate:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to activate school",
      },
      { status: 500 }
    );
  }
}
