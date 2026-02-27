// src/app/api/admin/promotions/policies/route.ts
// PROMO-BE-002: POST create promotion policy
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import { CreatePromotionPolicySchema } from "@/schemas/promotion-policy";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import mongoose from "mongoose";

/**
 * POST /api/admin/promotions/policies
 * Create a new promotion policy (draft). Requires Idempotency-Key header.
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const parsed = CreatePromotionPolicySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    // Version: next version after highest existing for this school
    const maxVersion = await PromotionPolicy.findOne({ schoolId: schoolIdObj })
      .sort({ version: -1 })
      .select("version")
      .lean();
    const nextVersion = (maxVersion?.version ?? 0) + 1;

    const gradeIds = (input.appliesTo?.gradeIds || [])
      .map((id) => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const policy = await PromotionPolicy.create({
      schoolId: schoolIdObj,
      name: input.name,
      version: nextVersion,
      isActive: false,
      appliesTo: {
        stage: input.appliesTo?.stage,
        gradeIds: gradeIds.length > 0 ? gradeIds : undefined,
      },
      criteria: input.criteria,
      logic: input.logic,
      thresholds: input.thresholds,
      tieBreaker: input.tieBreaker,
      attendanceComputation: input.attendanceComputation,
      financeHold: input.financeHold,
      manualOverrideRules: input.manualOverrideRules,
      createdBy: userIdObj,
      updatedBy: userIdObj,
    });

    await recordPromotionActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "promotion.policy.created",
      entityType: "PromotionPolicy",
      entityId: policy._id,
      description: `Created promotion policy: ${input.name}`,
      metadata: { policyId: String(policy._id), name: input.name, version: policy.version },
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
    console.error("Promotion policies POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create policy" },
      { status: 500 }
    );
  }
}
