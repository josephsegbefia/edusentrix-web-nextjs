/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentInsightsDTO } from "@/lib/insights/buildStudentInsightsDTO";
import { AIInsightCache } from "@/models/AIInsightCache";
import OpenAI from "openai";
import mongoose from "mongoose";

function formatMinorToMajor(minor: number): string {
  return (minor / 100).toFixed(2);
}

function buildPrompt(dto: any): string {
  const subjectLines = dto.subjectDetails
    .map(
      (s: any) =>
        `- ${s.subjectName}: ${s.totalScore}% (CA: ${s.caPercentage}%, Exam: ${s.examPercentage}%${s.classAvg != null ? `, Class avg: ${s.classAvg}%` : ""})`
    )
    .join("\n");

  const termLines =
    dto.termHistory
      .map(
        (t: any) =>
          `- ${t.label}: Student ${t.averageScore ?? "N/A"}%, Class ${t.classAverage ?? "N/A"}%`
      )
      .join("\n") || "No history available";

  const commentLines =
    dto.recentComments.length > 0
      ? dto.recentComments
          .map(
            (c: any) =>
              `- "${c.comment}" — ${c.teacherName ?? "Unknown"}, ${c.type}, ${c.date.slice(0, 10)}`
          )
          .join("\n")
      : "No comments this term";

  const rb = dto.ruleBased;
  const att = rb.attendanceBreakdown;
  const fees = dto.feesDetail;

  return `Analyze this student's holistic performance and provide structured insights.

STUDENT: ${dto.studentName}
GRADE: ${dto.gradeName ?? "N/A"}
CLASS: ${dto.classGroupName ?? "N/A"}

── ACADEMIC PERFORMANCE ──
Overall Average: ${rb.classPosition != null ? `Position ${rb.classPosition} of ${rb.classSize}` : "N/A"}
Risk Level: ${rb.riskLevel}
Trend: ${rb.trend}${rb.trendDelta != null ? ` (${rb.trendDelta > 0 ? "+" : ""}${rb.trendDelta} points)` : ""}
CA vs Exam Gap: ${rb.caVsExamGap != null ? `${rb.caVsExamGap > 0 ? "+" : ""}${rb.caVsExamGap} (${rb.caVsExamGap > 0 ? "stronger in CA" : "stronger in exams"})` : "N/A"}

Subject Scores:
${subjectLines || "No subjects"}

Term History:
${termLines}

── ATTENDANCE (Current Term) ──
${att ? `Rate: ${rb.attendanceRate}% (${att.present + att.late}/${att.total} days)
Present: ${att.present} | Absent: ${att.absent} | Late: ${att.late} | Excused: ${att.excused}
Most-missed day: ${rb.mostMissedDay ?? "N/A"}
Avg late minutes: ${rb.avgLateMinutes ?? "N/A"}` : "No attendance data recorded yet"}

── FINANCIAL STATUS ──
${fees ? `Billed: GHS ${formatMinorToMajor(fees.totalBilledMinor)}
Paid: GHS ${formatMinorToMajor(fees.totalPaidMinor)} | Outstanding: GHS ${formatMinorToMajor(fees.outstandingMinor)}
Status: ${rb.feesStatus ?? "N/A"}
Overdue invoices: ${rb.overdueInvoices}
Payment consistency: ${rb.paymentConsistency != null ? `${rb.paymentConsistency}% on-time` : "N/A"}` : "No fee records"}

── BEHAVIOUR / TEACHER COMMENTS ──
Comments this term: ${rb.teacherCommentCount}
${commentLines}

Provide your analysis in this exact JSON format (no markdown, no code blocks, just valid JSON):
{
  "summary": "2-3 sentence holistic overview",
  "riskLevel": "low|medium|high",
  "academic": {
    "narrative": "2-3 sentences on academic patterns",
    "strengths": [{ "subject": "...", "reason": "...", "score": 85 }],
    "weaknesses": [{ "subject": "...", "reason": "...", "score": 52, "trend": "improving|declining|stable" }],
    "prioritySubjects": ["Subject names to focus on"]
  },
  "attendance": {
    "narrative": "1-2 sentences on attendance patterns",
    "patterns": ["pattern1", "pattern2"],
    "correlationWithGrades": "1 sentence"
  },
  "financial": {
    "narrative": "1-2 sentences on payment patterns",
    "riskAssessment": "1 sentence"
  },
  "behaviour": {
    "narrative": "1-2 sentences",
    "observations": ["observation1"]
  },
  "recommendations": {
    "student": ["action1", "action2", "action3"],
    "parent": ["action1", "action2"],
    "teacher": ["action1", "action2"]
  },
  "additionalInsights": {
    "overallTrend": "1 sentence",
    "examVsCA": "1 sentence comparing CA and exam performance",
    "classComparison": "1 sentence",
    "learningStyle": "1 sentence observation or null"
  }
}

Be specific, actionable, and culturally appropriate for Ghanaian education context.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const { id: studentId } = await params;

    if (!schoolId) {
      return NextResponse.json({ error: "School not found" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables." },
        { status: 503 }
      );
    }

    await connectToDatabase();

    // Rate limit: max 5 regenerations per student per day
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await AIInsightCache.countDocuments({
      studentId,
      schoolId,
      generatedAt: { $gte: dayAgo },
    });
    if (recentCount >= 5) {
      return NextResponse.json(
        { error: "Rate limit reached. Max 5 generations per student per day." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const periodId = body.periodId || undefined;

    const dto = await buildStudentInsightsDTO({
      schoolId: schoolId!,
      studentId,
      periodId,
    });

    if (!dto.currentPeriodId) {
      return NextResponse.json(
        { error: "No academic period found" },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(dto);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Ghanaian education analyst providing holistic student insights. Always respond with valid JSON only, no markdown formatting.",
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

    let aiGenerated;
    try {
      aiGenerated = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiGenerated = JSON.parse(jsonMatch[0]);
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
      : null;

    // Upsert cache
    const cached = await AIInsightCache.findOneAndUpdate(
      {
        schoolId,
        studentId,
        academicPeriodId: dto.currentPeriodId,
      },
      {
        schoolId,
        studentId,
        academicPeriodId: dto.currentPeriodId,
        ruleBased: dto.ruleBased,
        aiGenerated,
        generatedBy: userId,
        generatedAt: new Date(),
        tokenUsage,
        modelUsed: "gpt-4o-mini",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: {
        ...dto,
        aiGenerated,
        generatedAt: new Date().toISOString(),
        tokenUsage,
        canGenerate: true,
      },
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
