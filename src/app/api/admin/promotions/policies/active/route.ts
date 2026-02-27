// src/app/api/admin/promotions/policies/active/route.ts
// PROMO-BE-002: GET active promotion policy
import { NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import mongoose from "mongoose";

/**
 * GET /api/admin/promotions/policies/active
 * Returns the active promotion policy for the school, or null if none.
 */
export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const policy = await PromotionPolicy.findOne({
      schoolId: schoolIdObj,
      isActive: true,
    })
      .lean();

    if (!policy) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    const data = {
      id: String(policy._id),
      schoolId: String(policy.schoolId),
      name: policy.name,
      version: policy.version,
      isActive: policy.isActive,
      appliesTo: {
        stage: policy.appliesTo?.stage,
        gradeIds: (policy.appliesTo?.gradeIds || []).map(String),
      },
      criteria: policy.criteria,
      logic: policy.logic,
      thresholds: policy.thresholds,
      tieBreaker: policy.tieBreaker,
      attendanceComputation: policy.attendanceComputation,
      financeHold: policy.financeHold,
      manualOverrideRules: policy.manualOverrideRules,
      createdBy: String(policy.createdBy),
      updatedBy: String(policy.updatedBy),
      createdAt: policy.createdAt?.toISOString(),
      updatedAt: policy.updatedAt?.toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Promotion policies/active GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch active policy" },
      { status: 500 }
    );
  }
}
