// src/app/api/admin/promotions/policies/[id]/activate/route.ts
// PROMO-BE-002: POST activate promotion policy (deactivates all others)
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import mongoose from "mongoose";

/**
 * POST /api/admin/promotions/policies/:id/activate
 * Activate this policy and deactivate only overlapping active policies.
 * A whole-school policy still replaces all active policies.
 * Requires Idempotency-Key header.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const idempotencyKey = req.headers.get("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        { success: false, error: "Idempotency-Key header is required" },
        { status: 400 }
      );
    }

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
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const policy = await PromotionPolicy.findOne({
      _id: policyObjId,
      schoolId: schoolIdObj,
    });

    if (!policy) {
      return NextResponse.json(
        { success: false, error: "Policy not found" },
        { status: 404 }
      );
    }

    const selectedGradeIds = (policy.appliesTo?.gradeIds || []).map(String);
    const hasGradeScope = selectedGradeIds.length > 0;

    if (!hasGradeScope) {
      await PromotionPolicy.updateMany(
        { schoolId: schoolIdObj },
        { $set: { isActive: false, updatedBy: userIdObj, updatedAt: new Date() } }
      );
    } else {
      const activePolicies = await PromotionPolicy.find({
        schoolId: schoolIdObj,
        isActive: true,
        _id: { $ne: policyObjId },
      }).select("_id appliesTo");

      const overlappingPolicyIds = activePolicies
        .filter((activePolicy) => {
          const activeGradeIds = (activePolicy.appliesTo?.gradeIds || []).map(String);
          if (activeGradeIds.length === 0) return true;
          return activeGradeIds.some((gradeId) => selectedGradeIds.includes(gradeId));
        })
        .map((activePolicy) => activePolicy._id);

      if (overlappingPolicyIds.length > 0) {
        await PromotionPolicy.updateMany(
          { _id: { $in: overlappingPolicyIds }, schoolId: schoolIdObj },
          { $set: { isActive: false, updatedBy: userIdObj, updatedAt: new Date() } }
        );
      }
    }

    // Activate this policy
    policy.isActive = true;
    policy.updatedBy = userIdObj;
    await policy.save();

    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.policy.activated",
      entityType: "PromotionPolicy",
      entityId: policy._id,
      description: `Activated promotion policy: ${policy.name} (v${policy.version})`,
      metadata: { policyId: String(policy._id), name: policy.name, version: policy.version },
    });

    const p = policy.toObject();
    const data = {
      id: String(p._id),
      schoolId: String(p.schoolId),
      name: p.name,
      version: p.version,
      isActive: p.isActive,
      appliesTo: {
        stage: p.appliesTo?.stage,
        gradeIds: (p.appliesTo?.gradeIds || []).map(String),
      },
      criteria: p.criteria,
      logic: p.logic,
      thresholds: p.thresholds,
      tieBreaker: p.tieBreaker,
      attendanceComputation: p.attendanceComputation,
      financeHold: p.financeHold,
      manualOverrideRules: p.manualOverrideRules,
      createdBy: String(p.createdBy),
      updatedBy: String(p.updatedBy),
      createdAt: p.createdAt?.toISOString(),
      updatedAt: p.updatedAt?.toISOString(),
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Promotion policy activate error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate policy" },
      { status: 500 }
    );
  }
}
