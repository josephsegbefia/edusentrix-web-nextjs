// src/app/api/admin/roles-duties/ai-insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildRolesDutiesContext } from "@/lib/rolesDuties/buildRolesDutiesContext";
import { AICachedInsight } from "@/models/AICachedInsight";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";

const TabSchema = z.enum(["student-roles", "teacher-duties", "class-roles"]);
const BodySchema = z.object({ tab: TabSchema });

type RolesDutiesInsights = {
  summary: string;
  insights: string[];
  recommendedActions: string[];
};

/**
 * GET - Load cached AI insights for the given tab.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const tab = request.nextUrl.searchParams.get("tab");

    const parsed = TabSchema.safeParse(tab);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tab. Must be one of: student-roles, teacher-duties, class-roles" },
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

    const context = await buildRolesDutiesContext(schoolObjectId, parsed.data);
    const currentFingerprint = computeDataFingerprint(context);

    const cached = await AICachedInsight.findOne({
      schoolId: schoolObjectId,
      scope: "roles_duties",
      scopeKey: parsed.data,
    }).lean();

    if (cached && cached.insights) {
      const insights = cached.insights as RolesDutiesInsights;
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
    console.error("Error loading roles-duties AI insights:", error);
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
    const { schoolId, userId } = await requireSchoolAdmin();

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
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body. tab must be one of: student-roles, teacher-duties, class-roles" },
        { status: 400 }
      );
    }

    const { tab } = parsed.data;

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const context = await buildRolesDutiesContext(schoolObjectId, tab);
    const currentFingerprint = computeDataFingerprint(context);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert school administrator analyzing roles and duties data. Provide structured insights in JSON only. Be concise and actionable.",
        },
        {
          role: "user",
          content: `Analyze this roles/duties data and respond with valid JSON in this exact format (no markdown, no code blocks):
{
  "summary": "2-3 sentence overview of the current state",
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

    let data: RolesDutiesInsights;
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
        scope: "roles_duties",
        scopeKey: tab,
      },
      {
        schoolId: schoolObjectId,
        scope: "roles_duties",
        scopeKey: tab,
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

    console.error("Error generating roles-duties AI insights:", error);
    return NextResponse.json(
      {
        error: "Failed to generate AI insights",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
