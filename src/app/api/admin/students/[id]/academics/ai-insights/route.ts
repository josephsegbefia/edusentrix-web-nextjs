// src/app/api/admin/students/[id]/academics/ai-insights/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentAcademicsDTO } from "@/lib/academics/buildStudentAcademicsDTO";
import OpenAI from "openai";
import mongoose from "mongoose";
import { Student } from "@/models/Student";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { id: studentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const termId = searchParams.get("termId") || null;

    await connectToDatabase();

    // Get student and schoolId
    const student = await Student.findById(studentId)
      .select("schoolId firstName lastName")
      .lean<{
        schoolId?: mongoose.Types.ObjectId;
        firstName?: string;
        lastName?: string;
      } | null>();

    if (!student?.schoolId) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const schoolId = student.schoolId.toString();
    const studentName = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();

    // Build academics DTO
    const academicsDTO = await buildStudentAcademicsDTO({
      schoolId,
      studentId,
      academicPeriodId: termId,
    });

    // Prepare data for AI prompt
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

    const prompt = `You are an experienced Ghanaian teacher analyzing a student's academic performance. Provide structured insights in JSON format.

Student: ${studentName}
Overall Average: ${academicsDTO.summary.overallAverage ?? "N/A"}%
Class Position: ${academicsDTO.summary.classPosition ?? "N/A"} of ${academicsDTO.summary.totalStudents ?? "N/A"}
Performance Tier: ${academicsDTO.summary.performanceTier ?? "N/A"}
Trend: ${academicsDTO.summary.trend} ${academicsDTO.summary.trendDelta ? `(${academicsDTO.summary.trendDelta > 0 ? "+" : ""}${academicsDTO.summary.trendDelta} points)` : ""}
Risk Level: ${academicsDTO.riskLevel ?? "low"}

Subject Performance:
${subjectScores}

Class Averages:
${classAveragesText}

Term History:
${termHistory}

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
    "student": [
      "Actionable advice for the student"
    ],
    "parent": [
      "Actionable advice for parents"
    ],
    "teacher": [
      "Actionable advice for teachers"
    ]
  },
  "prioritySubjects": ["Subject names to focus on"],
  "insights": {
    "overallTrend": "Description of overall performance trend",
    "examVsCA": "Comparison between CA and exam performance",
    "classComparison": "How student compares to class average"
  }
}

Be specific, actionable, and culturally appropriate for Ghanaian education context.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced Ghanaian teacher providing academic insights. Always respond with valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    // Parse JSON response
    let aiInsights;
    try {
      aiInsights = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback: try to extract JSON from markdown if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiInsights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    return NextResponse.json({
      success: true,
      data: aiInsights,
    });
  } catch (error) {
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
