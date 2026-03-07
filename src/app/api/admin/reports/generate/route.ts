// src/app/api/admin/reports/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { PeriodReport } from "@/models/PeriodReport";
import { buildReportContextForDateRange } from "@/lib/periods/buildPeriodReportContext";
import { computeDataFingerprint } from "@/lib/ai/dataFingerprint";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { trackUsage } from "@/lib/billing/trackUsage";

export type RecurringReportType = "weekly" | "biweekly" | "monthly";

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const {
      startDate,
      endDate,
      reportType,
      academicPeriodId,
    }: {
      startDate?: string;
      endDate?: string;
      reportType?: RecurringReportType;
      academicPeriodId?: string;
    } = body;

    if (!startDate || !endDate || !reportType) {
      return NextResponse.json(
        { error: "Missing required fields: startDate, endDate, reportType" },
        { status: 400 }
      );
    }

    const validTypes: RecurringReportType[] = ["weekly", "biweekly", "monthly"];
    if (!validTypes.includes(reportType)) {
      return NextResponse.json(
        { error: "reportType must be weekly, biweekly, or monthly" },
        { status: 400 }
      );
    }

    const periodId = academicPeriodId;
    if (!periodId || !mongoose.Types.ObjectId.isValid(periodId)) {
      return NextResponse.json(
        { error: "Valid academicPeriodId is required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      );
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

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
    const periodIdObj = new mongoose.Types.ObjectId(periodId);
    const userIdObj =
      userId instanceof mongoose.Types.ObjectId
        ? userId
        : new mongoose.Types.ObjectId(String(userId));

    const period = await AcademicPeriod.findOne({
      _id: periodIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const context = await buildReportContextForDateRange(
      schoolIdObj,
      periodIdObj,
      start,
      end
    );
    if (!context) {
      return NextResponse.json(
        { error: "Could not build report context for date range" },
        { status: 500 }
      );
    }

    const fingerprint = computeDataFingerprint(JSON.stringify(context));

    const existing = await PeriodReport.findOne({
      schoolId: schoolIdObj,
      academicPeriodId: periodIdObj,
      reportType,
      "dateRange.startDate": start,
      "dateRange.endDate": end,
    }).lean();

    const forceRegenerate = body.force === true;
    if (
      existing &&
      !forceRegenerate &&
      existing.dataFingerprint === fingerprint
    ) {
      return NextResponse.json({
        success: true,
        data: {
          id: String(existing._id),
          periodId: String(existing.academicPeriodId),
          reportType: existing.reportType,
          dateRange: existing.dateRange,
          content: existing.content,
          generatedAt: existing.generatedAt,
        },
        source: "cache",
      });
    }

    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxAICallsPerMonth",
      message:
        "The monthly AI report generation limit has been reached for this school.",
    });

    const reportLabel =
      reportType === "weekly"
        ? "Weekly"
        : reportType === "biweekly"
          ? "Biweekly"
          : "Monthly";

    const prompt = `You are an experienced Ghanaian school administrator and education analyst. Generate a concise ${reportLabel.toLowerCase()} progress report for a school.

**Period Context:** ${context.period.term} ${context.period.yearLabel}
**Report Range:** ${context.period.startDate} to ${context.period.endDate}

**Data Summary (for this date range):**
- Finances: ${context.finances.invoiceCount} invoices issued, ${context.finances.paidInvoiceCount} paid, ${context.finances.overdueInvoiceCount} overdue. Total billed: GHS ${(context.finances.totalBilledMinor / 100).toLocaleString()}. Collected: GHS ${(context.finances.totalCollectedMinor / 100).toLocaleString()}. Collection rate: ${context.finances.collectionRatePct}%
- Academics: ${context.academics.assessmentCount} assessments graded, ${context.academics.termResultCount} term results, ${context.academics.studentCountWithResults} students with results
- Staffing: ${context.staffing.teacherAssignmentCount} teacher assignments, ${context.staffing.studentRoleCount} student class roles
- Timetable: ${context.timetable.versionCount} version(s), published: ${context.timetable.hasPublished ? "Yes" : "No"}
${context.attendance ? `- Attendance: ${context.attendance.recordCount} records, ${context.attendance.presentCount} present, ${context.attendance.absentCount} absent` : ""}

Provide your analysis in this exact JSON format (no markdown, no code blocks, valid JSON only):
{
  "summary": "2-3 sentence executive summary of this ${reportLabel.toLowerCase()} period",
  "sections": [
    {
      "title": "Section title (e.g. Financial Snapshot)",
      "content": "Brief paragraph. Use specific numbers from the data.",
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

Include sections for: Financial Snapshot, Academic Progress, and Operations. Keep it concise for a ${reportLabel.toLowerCase()} report.
Suggestions must be specific and actionable.
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

    let parsed: {
      summary?: string;
      sections?: Array<{
        title: string;
        content: string;
        highlights?: string[];
      }>;
      suggestions?: Array<{ text: string; category?: string }>;
    };
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
        reportType,
        "dateRange.startDate": start,
        "dateRange.endDate": end,
      },
      {
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        reportType,
        dateRange: { startDate: start, endDate: end },
        content,
        dataFingerprint: fingerprint,
        generatedAt: new Date(),
        generatedBy: userIdObj,
      },
      { upsert: true, new: true }
    );

    await trackUsage({
      schoolId,
      provider: "openai",
      metricKey: "ai_calls",
      quantity: 1,
      unitLabel: "calls",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Recurring AI report generation.",
    });
    await trackUsage({
      schoolId,
      provider: "openai",
      metricKey: "total_tokens",
      quantity: Math.max(0, Number(completion.usage?.total_tokens || 0)),
      unitLabel: "tokens",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: "Recurring AI report token usage.",
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(report._id),
        periodId: String(report.academicPeriodId),
        reportType: report.reportType,
        dateRange: report.dateRange,
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
    if (error instanceof Response) return error;
    console.error("Error generating recurring report:", error);
    return NextResponse.json(
      {
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
