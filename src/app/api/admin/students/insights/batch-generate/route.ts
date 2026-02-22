/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentInsightsDTO } from "@/lib/insights/buildStudentInsightsDTO";
import { AIInsightCache } from "@/models/AIInsightCache";
import { Student } from "@/models/Student";
import OpenAI from "openai";
import mongoose from "mongoose";

const MAX_BATCH = 50;
const DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
      .join("\n") || "No history";

  const commentLines =
    dto.recentComments.length > 0
      ? dto.recentComments
          .map(
            (c: any) =>
              `- "${c.comment}" — ${c.teacherName ?? "Unknown"}, ${c.type}`
          )
          .join("\n")
      : "None";

  const rb = dto.ruleBased;
  const att = rb.attendanceBreakdown;
  const fees = dto.feesDetail;

  return `Analyze this student's holistic performance. Respond with valid JSON only.

STUDENT: ${dto.studentName} | GRADE: ${dto.gradeName ?? "N/A"} | CLASS: ${dto.classGroupName ?? "N/A"}
Overall Risk: ${rb.riskLevel} | Trend: ${rb.trend}${rb.trendDelta != null ? ` (${rb.trendDelta > 0 ? "+" : ""}${rb.trendDelta})` : ""}
Position: ${rb.classPosition ?? "N/A"}/${rb.classSize ?? "N/A"} | CA-Exam Gap: ${rb.caVsExamGap ?? "N/A"}

Subjects: ${subjectLines || "None"}
History: ${termLines}
Attendance: ${att ? `${rb.attendanceRate}% (${att.present + att.late}/${att.total}), Absent: ${att.absent}, Late: ${att.late}` : "N/A"}
Fees: ${fees ? `GHS ${formatMinorToMajor(fees.outstandingMinor)} outstanding, ${rb.feesStatus}` : "N/A"}
Comments: ${commentLines}

JSON format:
{"summary":"...","riskLevel":"low|medium|high","academic":{"narrative":"...","strengths":[{"subject":"...","reason":"...","score":0}],"weaknesses":[{"subject":"...","reason":"...","score":0,"trend":"..."}],"prioritySubjects":["..."]},"attendance":{"narrative":"...","patterns":["..."],"correlationWithGrades":"..."},"financial":{"narrative":"...","riskAssessment":"..."},"behaviour":{"narrative":"...","observations":["..."]},"recommendations":{"student":["..."],"parent":["..."],"teacher":["..."]},"additionalInsights":{"overallTrend":"...","examVsCA":"...","classComparison":"...","learningStyle":null}}

Be specific and culturally appropriate for Ghanaian education.`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();

    if (!schoolId) {
      return NextResponse.json({ error: "School not found" }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const periodId = body.periodId || undefined;

    await connectToDatabase();

    // Resolve student list
    let studentIds: string[] = [];

    if (body.studentIds && Array.isArray(body.studentIds)) {
      studentIds = body.studentIds
        .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
        .slice(0, MAX_BATCH);
    } else if (body.classGroupId) {
      const students = await Student.find({
        schoolId,
        classGroupId: body.classGroupId,
        status: "active",
      })
        .select("_id")
        .limit(MAX_BATCH)
        .lean();
      studentIds = students.map((s: any) => s._id.toString());
    } else if (body.gradeId) {
      const students = await Student.find({
        schoolId,
        gradeId: body.gradeId,
        status: "active",
      })
        .select("_id")
        .limit(MAX_BATCH)
        .lean();
      studentIds = students.map((s: any) => s._id.toString());
    } else {
      return NextResponse.json(
        { error: "Provide studentIds, classGroupId, or gradeId" },
        { status: 400 }
      );
    }

    if (studentIds.length === 0) {
      return NextResponse.json(
        { error: "No students found" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const results = {
      total: studentIds.length,
      generated: 0,
      failed: 0,
      skipped: 0,
      failures: [] as Array<{ studentId: string; error: string }>,
      totalTokens: 0,
    };

    for (const sid of studentIds) {
      try {
        const dto = await buildStudentInsightsDTO({
          schoolId: schoolId!,
          studentId: sid,
          periodId,
        });

        if (!dto.currentPeriodId) {
          results.skipped++;
          continue;
        }

        if (dto.subjectDetails.length === 0 && !dto.ruleBased.attendanceRate) {
          results.skipped++;
          continue;
        }

        const prompt = buildPrompt(dto);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an experienced Ghanaian education analyst. Respond with valid JSON only.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          response_format: { type: "json_object" },
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("Empty AI response");

        let aiGenerated;
        try {
          aiGenerated = JSON.parse(text);
        } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) aiGenerated = JSON.parse(m[0]);
          else throw new Error("Unparseable response");
        }

        const tokenUsage = completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens,
            }
          : null;

        if (tokenUsage) results.totalTokens += tokenUsage.totalTokens;

        await AIInsightCache.findOneAndUpdate(
          {
            schoolId,
            studentId: sid,
            academicPeriodId: dto.currentPeriodId,
          },
          {
            schoolId,
            studentId: sid,
            academicPeriodId: dto.currentPeriodId,
            ruleBased: dto.ruleBased,
            aiGenerated,
            generatedBy: userId,
            generatedAt: new Date(),
            tokenUsage,
            modelUsed: "gpt-4o-mini",
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        results.generated++;
        await sleep(DELAY_MS);
      } catch (err: any) {
        results.failed++;
        results.failures.push({
          studentId: sid,
          error: err?.message ?? "Unknown error",
        });
      }
    }

    const estimatedCost = (results.totalTokens / 1_000_000) * 0.15;

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        estimatedCost: `$${estimatedCost.toFixed(4)}`,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Batch generation error:", error);
    return NextResponse.json(
      { error: "Batch generation failed" },
      { status: 500 }
    );
  }
}
