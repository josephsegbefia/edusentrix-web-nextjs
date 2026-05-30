import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import {
  assertGradeIdsBelongToSchool,
  buildGradingPolicyDocument,
  listGradingPolicies,
  parseGradingPolicyBody,
  serializeGradingPolicy,
  validateGradingPolicyPayload,
} from "@/lib/academics/assessment-engine/grading-policy-service";

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
    const data = await listGradingPolicies({
      schoolId: toObjectId(schoolId),
      status: searchParams.get("status"),
      curriculumCode: searchParams.get("curriculumCode"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Grading policies GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch grading policies" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

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

    const created = await AcademicGradingPolicy.create(
      buildGradingPolicyDocument(parsedBody.data, {
        schoolId: schoolIdObj,
        userId: toObjectId(userId),
        status: "draft",
      })
    );

    return NextResponse.json(
      { success: true, data: serializeGradingPolicy(created) },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const isDuplicate =
      error instanceof Error &&
      (error.message.includes("E11000") || error.message.includes("duplicate key"));
    console.error("Grading policies POST:", error);
    return NextResponse.json(
      {
        success: false,
        error: isDuplicate
          ? "A grading policy with this name already exists for this school."
          : "Failed to create grading policy",
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }
}
