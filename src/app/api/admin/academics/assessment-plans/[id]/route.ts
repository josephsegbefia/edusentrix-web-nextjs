import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import {
  parseAssessmentPlanBody,
  serializeAssessmentPlan,
  validateAssessmentPlanReferences,
} from "@/lib/academics/assessment-engine/assessment-plan-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function parsePlanId(id: string) {
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
    const planId = parsePlanId(id);
    if (!planId) {
      return NextResponse.json({ success: false, error: "Invalid plan id" }, { status: 400 });
    }

    const plan = await AssessmentPlan.findOne({
      _id: planId,
      schoolId: toObjectId(schoolId),
    }).lean();

    if (!plan) {
      return NextResponse.json({ success: false, error: "Assessment plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeAssessmentPlan(plan) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plan GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assessment plan" },
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
    const planId = parsePlanId(id);
    if (!planId) {
      return NextResponse.json({ success: false, error: "Invalid plan id" }, { status: 400 });
    }

    const existing = await AssessmentPlan.findOne({
      _id: planId,
      schoolId: toObjectId(schoolId),
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Assessment plan not found" }, { status: 404 });
    }

    if (existing.status === "archived") {
      return NextResponse.json(
        { success: false, error: "Archived assessment plans cannot be edited." },
        { status: 400 }
      );
    }

    if (existing.status === "locked") {
      return NextResponse.json(
        { success: false, error: "Locked assessment plans cannot be edited." },
        { status: 400 }
      );
    }

    const parsedBody = parseAssessmentPlanBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const schoolIdObj = toObjectId(schoolId);
    const nextStatus = existing.status === "active" ? "draft" : existing.status;
    const referenceCheck = await validateAssessmentPlanReferences(
      schoolIdObj,
      parsedBody.data,
      nextStatus
    );

    if (!referenceCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          error: referenceCheck.error,
          ...("errors" in referenceCheck ? { errors: referenceCheck.errors } : {}),
        },
        { status: 400 }
      );
    }

    existing.name = parsedBody.data.name;
    existing.academicPeriodId = new mongoose.Types.ObjectId(parsedBody.data.academicPeriodId);
    existing.gradingPolicyId = new mongoose.Types.ObjectId(parsedBody.data.gradingPolicyId);
    existing.appliesToGradeId = new mongoose.Types.ObjectId(parsedBody.data.appliesToGradeId);
    existing.appliesToGradeIds = [
      ...new Set([...(parsedBody.data.appliesToGradeIds ?? []), parsedBody.data.appliesToGradeId]),
    ].map((gradeId) => new mongoose.Types.ObjectId(gradeId));
    existing.appliesToClassGroupIds = parsedBody.data.appliesToClassGroupIds.map(
      (classGroupId) => new mongoose.Types.ObjectId(classGroupId)
    );
    existing.curriculumCode = parsedBody.data.curriculumCode ?? null;
    existing.componentRules = parsedBody.data.componentRules;
    existing.teacherCanCreateReportItems =
      parsedBody.data.teacherCanCreateReportItems ?? existing.teacherCanCreateReportItems;
    existing.teacherCanMarkItemsAsReportContributing =
      parsedBody.data.teacherCanMarkItemsAsReportContributing ??
      existing.teacherCanMarkItemsAsReportContributing;
    existing.allowOfflineMarks = parsedBody.data.allowOfflineMarks ?? existing.allowOfflineMarks;
    existing.allowAppAssignmentImport =
      parsedBody.data.allowAppAssignmentImport ?? existing.allowAppAssignmentImport;
    existing.allowCsvImport = parsedBody.data.allowCsvImport ?? existing.allowCsvImport;
    existing.minimumCompletionRules = parsedBody.data.minimumCompletionRules ?? [];
    existing.status = nextStatus;
    existing.approvedBy = null;
    existing.approvedAt = null;
    existing.createdBy = existing.createdBy ?? toObjectId(userId);

    await existing.save();

    return NextResponse.json({ success: true, data: serializeAssessmentPlan(existing) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plan PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assessment plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;
    const planId = parsePlanId(id);
    if (!planId) {
      return NextResponse.json({ success: false, error: "Invalid plan id" }, { status: 400 });
    }

    const plan = await AssessmentPlan.findOne({
      _id: planId,
      schoolId: toObjectId(schoolId),
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Assessment plan not found" }, { status: 404 });
    }

    if (plan.status === "locked") {
      return NextResponse.json(
        { success: false, error: "Locked assessment plans cannot be archived." },
        { status: 400 }
      );
    }

    plan.status = "archived";
    plan.approvedBy = null;
    plan.approvedAt = null;
    await plan.save();

    return NextResponse.json({ success: true, data: serializeAssessmentPlan(plan) });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plan DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Failed to archive assessment plan" },
      { status: 500 }
    );
  }
}
