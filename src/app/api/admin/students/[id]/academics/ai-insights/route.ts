import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentAcademicProfileDTO } from "@/lib/academics/profile/buildStudentAcademicProfileDTO";
import {
  buildAcademicAIInsightsContext,
  buildAcademicAIInsightsSystemPrompt,
  buildAcademicAIInsightsUserPrompt,
  profileHasAcademicInsightData,
} from "@/lib/academics/profile/build-academic-ai-insights-context";
import { AICachedInsight } from "@/models/AICachedInsight";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import OpenAI from "openai";
import mongoose from "mongoose";
import { Student } from "@/models/Student";

function readPeriodId(searchParams: URLSearchParams, body?: { termId?: string | null; periodId?: string | null }) {
  return searchParams.get("periodId") ?? searchParams.get("termId") ?? body?.periodId ?? body?.termId ?? null;
}

/**
 * GET - Load cached AI insights if available.
 * Returns cached data when fingerprint matches. Otherwise returns empty with metadata.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    const { id: studentId } = await params;
    const periodId = readPeriodId(request.nextUrl.searchParams);

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json({ error: "Invalid periodId" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const student = await Student.findOne({
      _id: studentId,
      schoolId: schoolObjectId,
    })
      .select("firstName lastName")
      .lean<{ firstName?: string; lastName?: string } | null>();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const profile = await buildStudentAcademicProfileDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: periodId,
      visibilityMode: "admin",
      allowProgressVisibility: true,
    });

    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
    const promptPayload = buildAcademicAIInsightsContext(profile, studentName);
    const currentFingerprint = computeDataFingerprint(promptPayload);

    const scopeKey = `${studentId}:${periodId ?? "current"}`;
    const cached = await AICachedInsight.findOne({
      schoolId: schoolObjectId,
      scope: "academic",
      scopeKey,
    }).lean();

    if (cached && cached.insights) {
      const isStale = cached.dataFingerprint !== currentFingerprint;
      return NextResponse.json({
        success: true,
        data: cached.insights as Record<string, unknown>,
        source: "cache",
        generatedAt: cached.generatedAt?.toISOString?.() ?? null,
        isStale,
        currentFingerprint: isStale ? currentFingerprint : undefined,
        insightMode: profile.aiInsights.mode,
        profileFingerprint: profile.aiInsights.dataFingerprint,
        hasAcademicData: profileHasAcademicInsightData(profile),
      });
    }

    return NextResponse.json({
      success: true,
      data: null,
      source: null,
      generatedAt: null,
      currentFingerprint,
      insightMode: profile.aiInsights.mode,
      profileFingerprint: profile.aiInsights.dataFingerprint,
      hasAcademicData: profileHasAcademicInsightData(profile),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error loading academic AI insights:", error);
    return NextResponse.json(
      { error: "Failed to load AI insights" },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate AI insights and save to cache.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "students.edit",
    ]);
    const { id: studentId } = await params;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const periodId = readPeriodId(request.nextUrl.searchParams, body);

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }
    if (periodId && !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json({ error: "Invalid periodId" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const student = await Student.findOne({
      _id: studentId,
      schoolId: schoolObjectId,
    })
      .select("firstName lastName")
      .lean<{ firstName?: string; lastName?: string } | null>();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const profile = await buildStudentAcademicProfileDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: periodId,
      visibilityMode: "admin",
      allowProgressVisibility: true,
    });

    if (!profileHasAcademicInsightData(profile)) {
      return NextResponse.json(
        {
          error:
            "Not enough academic data to generate insights for this period yet.",
        },
        { status: 400 }
      );
    }

    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
    const context = buildAcademicAIInsightsContext(profile, studentName);
    const currentFingerprint = computeDataFingerprint(context);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: buildAcademicAIInsightsSystemPrompt(profile.aiInsights.mode),
        },
        {
          role: "user",
          content: buildAcademicAIInsightsUserPrompt(context),
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    let aiInsights: Record<string, unknown>;
    try {
      aiInsights = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiInsights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const tokenUsage = completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined;

    const scopeKey = `${studentId}:${periodId ?? "current"}`;
    await AICachedInsight.findOneAndUpdate(
      {
        schoolId: schoolObjectId,
        scope: "academic",
        scopeKey,
      },
      {
        schoolId: schoolObjectId,
        scope: "academic",
        scopeKey,
        dataFingerprint: currentFingerprint,
        insights: aiInsights,
        generatedAt: new Date(),
        generatedBy: userId,
        tokenUsage,
        modelUsed: "gpt-4o-mini",
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data: aiInsights,
      source: "generated",
      generatedAt: new Date().toISOString(),
      tokenUsage,
      insightMode: profile.aiInsights.mode,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error generating AI insights:", error);
    return NextResponse.json(
      {
        error: "Failed to generate AI insights",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
