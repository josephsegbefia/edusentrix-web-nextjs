// src/app/api/admin/periods/[id]/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PeriodReport } from "@/models/PeriodReport";
import { buildPeriodReportContext } from "@/lib/periods/buildPeriodReportContext";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid period ID" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const periodIdObj = new mongoose.Types.ObjectId(id);

    const period = await AcademicPeriod.findOne({
      _id: periodIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const report = await PeriodReport.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodIdObj,
      reportType: "term",
    }).lean();

    if (!report) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No report generated yet",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(report._id),
        periodId: String(report.academicPeriodId),
        reportType: report.reportType,
        content: report.content,
        generatedAt: report.generatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching period report:", error);
    return NextResponse.json(
      { error: "Failed to fetch period report" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid period ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRegenerate = body.force === true;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const periodIdObj = new mongoose.Types.ObjectId(id);

    const period = await AcademicPeriod.findOne({
      _id: periodIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const context = await buildPeriodReportContext(schoolIdObj, periodIdObj);
    if (!context) {
      return NextResponse.json({ error: "Could not build period context" }, { status: 500 });
    }

    const fingerprint = computeDataFingerprint(JSON.stringify(context));

    const existing = await PeriodReport.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodIdObj,
      reportType: "term",
    }).lean();

    if (existing && !forceRegenerate && existing.dataFingerprint === fingerprint) {
      return NextResponse.json({
        success: true,
        data: {
          id: String(existing._id),
          periodId: String(existing.academicPeriodId),
          reportType: existing.reportType,
          content: existing.content,
          generatedAt: existing.generatedAt,
        },
        source: "cache",
      });
    }

    const prompt = `You are an experienced Ghanaian school administrator and education analyst. Generate a comprehensive, professional academic term report for a school.

**Period:** ${context.period.term} ${context.period.yearLabel}
**Dates:** ${context.period.startDate} to ${context.period.endDate}

**Data Summary:**
- Finances: ${context.finances.invoiceCount} invoices, ${context.finances.paidInvoiceCount} paid, ${context.finances.overdueInvoiceCount} overdue. Total billed: GHS ${(context.finances.totalBilledMinor / 100).toLocaleString()}. Collected: GHS ${(context.finances.totalCollectedMinor / 100).toLocaleString()}. Collection rate: ${context.finances.collectionRatePct}%
- Academics: ${context.academics.assessmentCount} assessments, ${context.academics.termResultCount} term results for ${context.academics.studentCountWithResults} students
- Staffing: ${context.staffing.teacherAssignmentCount} teacher assignments, ${context.staffing.studentRoleCount} student class roles
- Timetable: ${context.timetable.versionCount} version(s), published: ${context.timetable.hasPublished ? "Yes" : "No"}
${context.attendance ? `- Attendance: ${context.attendance.recordCount} records, ${context.attendance.presentCount} present, ${context.attendance.absentCount} absent` : ""}

Provide your analysis in this exact JSON format (no markdown, no code blocks, valid JSON only):
{
  "summary": "2-3 sentence executive summary of the term",
  "sections": [
    {
      "title": "Section title (e.g. Financial Performance)",
      "content": "Detailed paragraph of analysis. Use specific numbers from the data.",
      "highlights": ["Key point 1", "Key point 2"]
    }
  ],
  "suggestions": [
    {
      "text": "Actionable improvement suggestion",
      "category": "finance|academics|attendance|timetable|operations"
    }
  ]
}

Include sections for: Financial Performance, Academic Performance, Staffing & Operations, and Timetable. Add an "Areas for Improvement" section if relevant.
Suggestions must be specific, actionable, and appropriate for a Ghanaian school context.
Be professional and data-driven.`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced school administrator. Always respond with valid JSON only, no markdown.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error("No response from OpenAI");
    }

    let parsed: { summary?: string; sections?: Array<{ title: string; content: string; highlights?: string[] }>; suggestions?: Array<{ text: string; category?: string }> };
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    const content = {
      summary: parsed.summary ?? "",
      sections: (parsed.sections ?? []).map((s) => ({
        title: s.title ?? "",
        content: s.content ?? "",
        highlights: s.highlights ?? [],
      })),
      suggestions: (parsed.suggestions ?? []).map((s) => ({
        text: s.text ?? "",
        category: s.category ?? "operations",
        status: "pending" as const,
      })),
    };

    const report = await PeriodReport.findOneAndUpdate(
      {
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        reportType: "term",
      },
      {
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        reportType: "term",
        content,
        dataFingerprint: fingerprint,
        generatedAt: new Date(),
        generatedBy: userId,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: String(report._id),
        periodId: String(report.academicPeriodId),
        reportType: report.reportType,
        content: report.content,
        generatedAt: report.generatedAt,
      },
      source: "generated",
      tokenUsage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined,
    });
  } catch (error) {
    console.error("Error generating period report:", error);
    return NextResponse.json(
      {
        error: "Failed to generate period report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
