// src/app/api/admin/staff-attendance/ai-insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStaffAttendanceContext } from "@/lib/staffAttendance/buildStaffAttendanceContext";
import { AICachedInsight } from "@/models/AICachedInsight";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import OpenAI from "openai";
import mongoose from "mongoose";

type StaffAttendanceInsights = {
  summary: string;
  insights: string[];
  recommendedActions: string[];
};

/**
 * GET - Load cached AI insights for the given date.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } =
      await requireSchoolAdminOrDelegatedModuleView("staff_attendance");
    const dateStr = request.nextUrl.searchParams.get("date");

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Invalid date. Use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const context = await buildStaffAttendanceContext(schoolObjectId, dateStr);
    const currentFingerprint = computeDataFingerprint(context);

    const cached = await AICachedInsight.findOne({
      schoolId: schoolObjectId,
      scope: "staff_attendance",
      scopeKey: dateStr,
    }).lean();

    if (cached && cached.insights) {
      const insights = cached.insights as StaffAttendanceInsights;
      const isStale = cached.dataFingerprint !== currentFingerprint;
      return NextResponse.json({
        success: true,
        data: {
          summary: insights.summary ?? "",
          insights: Array.isArray(insights.insights) ? insights.insights : [],
          recommendedActions: Array.isArray(insights.recommendedActions)
            ? insights.recommendedActions
            : [],
        },
        source: "cache",
        generatedAt: cached.generatedAt?.toISOString?.() ?? null,
        isStale,
      });
    }

    return NextResponse.json({
      success: true,
      data: null,
      source: null,
      generatedAt: null,
      currentFingerprint,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error loading staff-attendance AI insights:", error);
    return NextResponse.json(
      { error: "Failed to load AI insights" },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate AI insights and save to cache.
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "staff_attendance.record",
      "staff_attendance.edit",
    ]);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const dateStr = body?.date;
    if (!dateStr || typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "Invalid body. date (YYYY-MM-DD) is required." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const context = await buildStaffAttendanceContext(schoolObjectId, dateStr);
    const currentFingerprint = computeDataFingerprint(context);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert school administrator analyzing staff attendance data. Provide structured insights in JSON only. Be concise and actionable. Focus on patterns, risks, and practical recommendations.",
        },
        {
          role: "user",
          content: `Analyze this staff attendance data for the given date and respond with valid JSON in this exact format (no markdown, no code blocks):
{
  "summary": "2-3 sentence overview of the attendance situation",
  "insights": ["insight1", "insight2", "..."],
  "recommendedActions": ["action1", "action2", "..."]
}

Data:
${context}`,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    let data: StaffAttendanceInsights;
    try {
      const parsedData = JSON.parse(responseText);
      data = {
        summary: parsedData.summary ?? "",
        insights: Array.isArray(parsedData.insights) ? parsedData.insights : [],
        recommendedActions: Array.isArray(parsedData.recommendedActions)
          ? parsedData.recommendedActions
          : [],
      };
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        data = {
          summary: parsedData.summary ?? "",
          insights: Array.isArray(parsedData.insights) ? parsedData.insights : [],
          recommendedActions: Array.isArray(parsedData.recommendedActions)
            ? parsedData.recommendedActions
            : [],
        };
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

    await AICachedInsight.findOneAndUpdate(
      {
        schoolId: schoolObjectId,
        scope: "staff_attendance",
        scopeKey: dateStr,
      },
      {
        schoolId: schoolObjectId,
        scope: "staff_attendance",
        scopeKey: dateStr,
        dataFingerprint: currentFingerprint,
        insights: data,
        generatedAt: new Date(),
        generatedBy: userId,
        tokenUsage,
        modelUsed: "gpt-4o-mini",
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data,
      source: "generated",
      generatedAt: new Date().toISOString(),
      tokenUsage,
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Error generating staff-attendance AI insights:", error);
    return NextResponse.json(
      {
        error: "Failed to generate AI insights",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
