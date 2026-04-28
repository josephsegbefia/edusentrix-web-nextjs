// src/app/api/admin/promotions/policies/route.ts
// PROMO-BE-002: POST create promotion policy
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionPolicy } from "@/models/PromotionPolicy";
import { CreatePromotionPolicySchema } from "@/schemas/promotion-policy";
import { recordPromotionActivity } from "@/lib/promotions/recordPromotionActivity";
import mongoose from "mongoose";

function serializePolicy(policy: Record<string, unknown>) {
  const appliesTo = policy.appliesTo as
    | { stage?: string; gradeIds?: unknown[] }
    | undefined;

  return {
    id: String(policy._id),
    schoolId: String(policy.schoolId),
    name: policy.name,
    version: policy.version,
    isActive: policy.isActive,
    appliesTo: {
      stage: appliesTo?.stage,
      gradeIds: (appliesTo?.gradeIds || []).map(String),
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
    createdAt: (policy.createdAt as Date | undefined)?.toISOString?.(),
    updatedAt: (policy.updatedAt as Date | undefined)?.toISOString?.(),
  };
}

/**
 * GET /api/admin/promotions/policies
 * List policies for the school. Optional query: active=1
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("promotions");
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active");

    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (active === "1" || active === "true") query.isActive = true;

    const policies = await PromotionPolicy.find(query)
      .sort({ isActive: -1, version: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: policies.map((policy) => serializePolicy(policy as Record<string, unknown>)),
    });
  } catch (error) {
    console.error("Promotion policies GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch policies" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/promotions/policies
 * Create a new promotion policy (draft). Requires Idempotency-Key header.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "promotions.operate",
    ]);
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

    return NextResponse.json({
      success: true,
      data: serializePolicy(policy.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    console.error("Promotion policies POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create policy" },
      { status: 500 }
    );
  }
}
