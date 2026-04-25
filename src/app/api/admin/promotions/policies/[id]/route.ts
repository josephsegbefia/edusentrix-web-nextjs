import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";

/**
 * DELETE /api/admin/promotions/policies/:id
 * Deletes a promotion policy for the current school.
 * Existing promotion cycles remain valid because they store policy snapshots.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const policyId = id?.trim();
    if (!policyId) {
      return NextResponse.json(
        { success: false, error: "Policy ID is required" },
        { status: 400 }
      );
    }

    let policyObjId: mongoose.Types.ObjectId;
    try {
      policyObjId = new mongoose.Types.ObjectId(policyId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid policy ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const policy = await PromotionPolicy.findOne({
      _id: policyObjId,
      schoolId: schoolIdObj,
    }).select("_id name");

    if (!policy) {
      return NextResponse.json(
        { success: false, error: "Policy not found" },
        { status: 404 }
      );
    }

    await PromotionPolicy.deleteOne({
      _id: policyObjId,
      schoolId: schoolIdObj,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(policy._id),
        name: policy.name,
      },
    });
  } catch (error) {
    console.error("Promotion policy DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete policy" },
      { status: 500 }
    );
  }
}
