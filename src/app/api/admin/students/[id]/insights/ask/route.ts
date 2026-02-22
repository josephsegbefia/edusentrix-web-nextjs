/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildStudentInsightsDTO } from "@/lib/insights/buildStudentInsightsDTO";
import { AIInsightCache } from "@/models/AIInsightCache";
import OpenAI from "openai";
import mongoose from "mongoose";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
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

    const body = await request.json();
    const question = body.question?.trim();
    if (!question || question.length > 500) {
      return NextResponse.json(
        { error: "Please provide a question (max 500 characters)" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const dto = await buildStudentInsightsDTO({
      schoolId: schoolId!,
      studentId,
      periodId: body.periodId || undefined,
    });

    // Load cached AI insights for richer context
    let cachedSummary = "";
    if (dto.currentPeriodId) {
      const cached = (await AIInsightCache.findOne({
        schoolId,
        studentId,
        academicPeriodId: dto.currentPeriodId,
      })
        .select("aiGenerated")
        .lean()) as any;

      if (cached?.aiGenerated) {
        cachedSummary = `\n\nPrevious AI Analysis:\n${JSON.stringify(cached.aiGenerated, null, 2)}`;
      }
    }

    const rb = dto.ruleBased;
    const context = `You are helping a school administrator with follow-up questions about a specific student.

Student: ${dto.studentName}
Grade: ${dto.gradeName ?? "N/A"} | Class: ${dto.classGroupName ?? "N/A"}
Risk Level: ${rb.riskLevel} | Trend: ${rb.trend}${rb.trendDelta != null ? ` (${rb.trendDelta > 0 ? "+" : ""}${rb.trendDelta})` : ""}
Attendance: ${rb.attendanceRate != null ? `${rb.attendanceRate}%` : "N/A"}
Fees: ${rb.feesStatus ?? "N/A"}${rb.overdueInvoices > 0 ? ` (${rb.overdueInvoices} overdue)` : ""}
Strengths: ${rb.strengths.map((s) => `${s.subject} (${s.score}%)`).join(", ") || "N/A"}
Weaknesses: ${rb.weaknesses.map((s) => `${s.subject} (${s.score}%)`).join(", ") || "N/A"}
${cachedSummary}

Answer the administrator's question concisely and actionably. Keep responses under 200 words. Be specific to this student's situation and culturally appropriate for Ghanaian education context.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: context },
        { role: "user", content: question },
      ],
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error in Ask AI:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}
