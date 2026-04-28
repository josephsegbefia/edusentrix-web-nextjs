// src/app/api/admin/students/[id]/academics/ai-insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import { AICachedInsight } from "@/models/AICachedInsight";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import OpenAI from "openai";
import mongoose from "mongoose";
import { Student } from "@/models/Student";

function buildPromptPayload(academicsDTO: Awaited<ReturnType<typeof buildStudentAcademicsDTO>>, studentName: string): string {
  const subjectScores = academicsDTO.subjects
    .map((s) => {
      const classAvg = academicsDTO.classAverages?.[s.subjectId] ?? null;
      return `- ${s.subjectName}: ${s.totalScore ?? "N/A"}%${
        classAvg !== null ? ` (Class avg: ${classAvg}%)` : ""
      }`;
    })
    .join("\n");

  const classAveragesText = academicsDTO.classAverages
    ? Object.entries(academicsDTO.classAverages)
        .map(([subjectId, avg]) => {
          const subject = academicsDTO.subjects.find(
            (s) => s.subjectId === subjectId
          );
          return `- ${subject?.subjectName ?? "Unknown"}: ${avg}%`;
        })
        .join("\n")
    : "Not available";

  const termHistory = academicsDTO.multiTermHistory
    ?.map(
      (t) =>
        `- ${t.label}: Student ${t.averageScore ?? "N/A"}%, Class ${t.classAverage ?? "N/A"}%`
    )
    .join("\n") ?? "No history available";

  return `Student: ${studentName}
Overall Average: ${academicsDTO.summary.overallAverage ?? "N/A"}%
Class Position: ${academicsDTO.summary.classPosition ?? "N/A"} of ${academicsDTO.summary.totalStudents ?? "N/A"}
Performance Tier: ${academicsDTO.summary.performanceTier ?? "N/A"}
Trend: ${academicsDTO.summary.trend} ${academicsDTO.summary.trendDelta ? `(${academicsDTO.summary.trendDelta > 0 ? "+" : ""}${academicsDTO.summary.trendDelta} points)` : ""}
Risk Level: ${academicsDTO.riskLevel ?? "N/A"}
Subject Performance:
${subjectScores}
Class Averages:
${classAveragesText}
Term History:
${termHistory}`;
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
    const searchParams = request.nextUrl.searchParams;
    const termId = searchParams.get("termId") || null;

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }
    if (termId && !mongoose.Types.ObjectId.isValid(termId)) {
      return NextResponse.json({ error: "Invalid termId" }, { status: 400 });
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

    const academicsDTO = await buildStudentAcademicsDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: termId,
    });

    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
    const promptPayload = buildPromptPayload(academicsDTO, studentName);
    const currentFingerprint = computeDataFingerprint(promptPayload);

    const scopeKey = `${studentId}:${termId ?? "current"}`;
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
    console.error("Error loading academic AI insights:", error);
    return NextResponse.json(
      { error: "Failed to load AI insights" },
      { status: 500 }
    );
  }
}

/**
 * POST - Generate AI insights and save to cache.
 * Only regenerates when forced or when data has changed (fingerprint).
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
    const termId = body.termId ?? null;

    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }
    if (termId && !mongoose.Types.ObjectId.isValid(termId)) {
      return NextResponse.json({ error: "Invalid termId" }, { status: 400 });
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

    const academicsDTO = await buildStudentAcademicsDTO({
      schoolId: schoolObjectId,
      studentId,
      academicPeriodId: termId,
    });

    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
    const promptPayload = buildPromptPayload(academicsDTO, studentName);
    const currentFingerprint = computeDataFingerprint(promptPayload);

    const prompt = `You are an experienced Ghanaian teacher analyzing a student's academic performance. Provide structured insights in JSON format.

${promptPayload}

Provide your analysis in this exact JSON format (no markdown, no code blocks, just valid JSON):
{
  "riskLevel": "low|medium|high",
  "summary": "1-2 sentence overview of the student's academic performance",
  "strengths": [
    {
      "subject": "Subject name",
      "reason": "Why this is a strength",
      "score": 85
    }
  ],
  "weaknesses": [
    {
      "subject": "Subject name",
      "reason": "Why this is a weakness",
      "score": 52,
      "trend": "improving|declining|stable"
    }
  ],
  "suggestedActions": {
    "student": ["Actionable advice for the student"],
    "parent": ["Actionable advice for parents"],
    "teacher": ["Actionable advice for teachers"]
  },
  "prioritySubjects": ["Subject names to focus on"],
  "insights": {
    "overallTrend": "Description of overall performance trend",
    "examVsCA": "Comparison between CA and exam performance",
    "classComparison": "How student compares to class average"
  }
}

Be specific, actionable, and culturally appropriate for Ghanaian education context.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Ghanaian teacher providing academic insights. Always respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
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

    const scopeKey = `${studentId}:${termId ?? "current"}`;
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
