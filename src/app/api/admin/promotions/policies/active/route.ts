// src/app/api/admin/promotions/policies/active/route.ts
// PROMO-BE-002: GET active promotion policy
import { NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import mongoose from "mongoose";

/**
 * GET /api/admin/promotions/policies/active
 * Returns all active promotion policies. `data` is kept as the first active
 * policy for older UI callers; `policies` is the scope-aware list.
 */
export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("promotions");
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const policies = await PromotionPolicy.find({
      schoolId: schoolIdObj,
      isActive: true,
    })
      .sort({ version: -1, createdAt: -1 })
      .lean();

    if (policies.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        policies: [],
      });
    }

    const serializePolicy = (policy: (typeof policies)[number]) => ({
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
    });

    const data = policies.map(serializePolicy);

    return NextResponse.json({ success: true, data: data[0] ?? null, policies: data });
  } catch (error) {
    console.error("Promotion policies/active GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch active policy" },
      { status: 500 }
    );
  }
}
