import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import {
  assertGradeIdsBelongToSchool,
  parseGradingPolicyBody,
  serializeGradingPolicy,
  validateGradingPolicyPayload,
} from "@/lib/academics/assessment-engine/grading-policy-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parsePolicyId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const policyId = parsePolicyId(id);
    if (!policyId) {
      return NextResponse.json({ success: false, error: "Invalid policy id" }, { status: 400 });
    }

    const policy = await AcademicGradingPolicy.findOne({
      _id: policyId,
      schoolId: toObjectId(schoolId),
    }).lean();

    if (!policy) {
      return NextResponse.json({ success: false, error: "Grading policy not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeGradingPolicy(policy) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Grading policy GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch grading policy" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const policyId = parsePolicyId(id);
    if (!policyId) {
      return NextResponse.json({ success: false, error: "Invalid policy id" }, { status: 400 });
    }

    const existing = await AcademicGradingPolicy.findOne({
      _id: policyId,
      schoolId: toObjectId(schoolId),
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Grading policy not found" }, { status: 404 });
    }

    if (existing.status === "archived") {
      return NextResponse.json(
        { success: false, error: "Archived grading policies cannot be edited." },
        { status: 400 }
      );
    }

    const parsedBody = parseGradingPolicyBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const validation = validateGradingPolicyPayload(parsedBody.data);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(" "), errors: validation.errors },
        { status: 400 }
      );
    }

    const schoolIdObj = toObjectId(schoolId);
    const gradeCheck = await assertGradeIdsBelongToSchool(
      schoolIdObj,
      parsedBody.data.appliesToGradeIds ?? []
    );
    if (!gradeCheck.ok) {
      return NextResponse.json({ success: false, error: gradeCheck.error }, { status: 400 });
    }

    existing.name = parsedBody.data.name;
    existing.description = parsedBody.data.description ?? null;
    existing.curriculumCode = parsedBody.data.curriculumCode ?? null;
    existing.gradeLabelMode = parsedBody.data.gradeLabelMode ?? existing.gradeLabelMode;
    existing.appliesToGradeIds = (parsedBody.data.appliesToGradeIds ?? []).map(
      (gradeId) => new mongoose.Types.ObjectId(gradeId)
    );
    existing.appliesToGradeBandCodes = parsedBody.data.appliesToGradeBandCodes ?? [];
    existing.isDefault = parsedBody.data.isDefault ?? false;
    existing.scoreComponents = parsedBody.data.scoreComponents;
    existing.gradeBoundaries = parsedBody.data.gradeBoundaries;
    existing.passMark = parsedBody.data.passMark;
    existing.roundingRule = parsedBody.data.roundingRule ?? existing.roundingRule;
    existing.showClassPosition =
      parsedBody.data.showClassPosition ?? existing.showClassPosition;
    existing.showSubjectPosition =
      parsedBody.data.showSubjectPosition ?? existing.showSubjectPosition;
    existing.showGradeKey = parsedBody.data.showGradeKey ?? existing.showGradeKey;
    existing.allowTeacherContributionSelection =
      parsedBody.data.allowTeacherContributionSelection ??
      existing.allowTeacherContributionSelection;
    existing.requireAdminApprovalForPolicyChanges =
      parsedBody.data.requireAdminApprovalForPolicyChanges ??
      existing.requireAdminApprovalForPolicyChanges;
    existing.updatedBy = toObjectId(userId);

    if (existing.status === "active") {
      existing.status = "draft";
    }

    await existing.save();

    return NextResponse.json({ success: true, data: serializeGradingPolicy(existing) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const isDuplicate =
      error instanceof Error &&
      (error.message.includes("E11000") || error.message.includes("duplicate key"));
    console.error("Grading policy PATCH:", error);
    return NextResponse.json(
      {
        success: false,
        error: isDuplicate
          ? "A grading policy with this name already exists for this school."
          : "Failed to update grading policy",
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const policyId = parsePolicyId(id);
    if (!policyId) {
      return NextResponse.json({ success: false, error: "Invalid policy id" }, { status: 400 });
    }

    const policy = await AcademicGradingPolicy.findOneAndUpdate(
      { _id: policyId, schoolId: toObjectId(schoolId) },
      {
        $set: {
          status: "archived",
          updatedBy: toObjectId(userId),
        },
      },
      { new: true }
    ).lean();

    if (!policy) {
      return NextResponse.json({ success: false, error: "Grading policy not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeGradingPolicy(policy) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Grading policy DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to archive grading policy" },
      { status: 500 }
    );
  }
}
