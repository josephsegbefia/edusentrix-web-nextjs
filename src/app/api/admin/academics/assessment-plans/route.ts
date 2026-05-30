import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import {
  buildAssessmentPlanDocument,
  listAssessmentPlans,
  parseAssessmentPlanBody,
  serializeAssessmentPlan,
  validateAssessmentPlanReferences,
} from "@/lib/academics/assessment-engine/assessment-plan-service";

function toObjectId(value: string | mongoose.Types.ObjectId) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const data = await listAssessmentPlans({
      schoolId: toObjectId(schoolId),
      status: searchParams.get("status"),
      academicPeriodId: searchParams.get("academicPeriodId"),
      gradeId: searchParams.get("gradeId"),
      gradingPolicyId: searchParams.get("gradingPolicyId"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plans GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch assessment plans" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const parsedBody = parseAssessmentPlanBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, error: parsedBody.error },
        { status: 400 }
      );
    }

    const schoolIdObj = toObjectId(schoolId);
    const referenceCheck = await validateAssessmentPlanReferences(
      schoolIdObj,
      parsedBody.data,
      "draft"
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

    const created = await AssessmentPlan.create(
      buildAssessmentPlanDocument(parsedBody.data, {
        schoolId: schoolIdObj,
        userId: toObjectId(userId),
        status: "draft",
      })
    );

    return NextResponse.json(
      { success: true, data: serializeAssessmentPlan(created) },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment plans POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assessment plan" },
      { status: 500 }
    );
  }
}
