/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentInsightsDTO } from "@/lib/insights/buildStudentInsightsDTO";
import { AIInsightCache } from "@/models/AIInsightCache";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, isAdmin } = await requireSchoolMember();
    const { id: studentId } = await params;

    if (!schoolId) {
      return NextResponse.json({ error: "School not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }

    const periodId =
      request.nextUrl.searchParams.get("periodId") || undefined;

    await connectToDatabase();

    const dto = await buildStudentInsightsDTO({
      schoolId: schoolId!,
      studentId,
      periodId,
    });

    // Look up cached AI insights
    let aiGenerated = null;
    let generatedAt: string | null = null;
    let tokenUsage = null;

    if (dto.currentPeriodId) {
      const cached = (await AIInsightCache.findOne({
        schoolId,
        studentId,
        academicPeriodId: dto.currentPeriodId,
      }).lean()) as any;

      if (cached?.aiGenerated) {
        aiGenerated = cached.aiGenerated;
        generatedAt = cached.generatedAt?.toISOString?.() ?? null;
        tokenUsage = cached.tokenUsage ?? null;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...dto,
        aiGenerated,
        generatedAt,
        tokenUsage,
        canGenerate: isAdmin,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching student insights:", error);
    return NextResponse.json(
      { error: "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
