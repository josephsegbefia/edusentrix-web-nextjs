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
      { _id: schoolId },
      { $set: { status: "deactivated" } },
      { new: true }
    )
      .select("_id status")
      .lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { schoolId: schoolIdParam, status: updated.status },
    });
  } catch (error) {
    console.error("platform school suspend:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to suspend school",
      },
      { status: 500 }
    );
  }
}
