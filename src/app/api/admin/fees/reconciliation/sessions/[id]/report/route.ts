import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationSession } from "@/models/ReconciliationSession";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { School } from "@/models/School";
import { ReportVerification } from "@/models/ReportVerification";
import { recordActivity } from "@/lib/audit/recordActivity";
import { toMajorUnits } from "@/lib/fees/money";
import crypto from "crypto";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function createVerificationId() {
  const random = crypto.randomBytes(12).toString("hex");
  const timestamp = Date.now().toString(36);
  return `RECON-${timestamp}-${random}`.toUpperCase();
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ ok: false, error: "Invalid session ID" }, { status: 400 });
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const session = await ReconciliationSession.findOne({
      _id: id,
      schoolId: schoolIdObj,
    }).lean();

    if (!session) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const notes: string = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

    const school = await School.findById(schoolIdObj).select("name").lean();
    const schoolName = (school as Record<string, unknown>)?.name
      ? String((school as Record<string, unknown>).name).trim()
      : "School";

    const [ingestionStats] = await ReconciliationIngestion.aggregate([
      { $match: { schoolId: schoolIdObj } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalMinor: { $sum: "$amountMinor" },
        },
      },
    ]);

    const statusBreakdown = (
      await ReconciliationIngestion.aggregate([
        { $match: { schoolId: schoolIdObj } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalMinor: { $sum: "$amountMinor" },
          },
        },
      ])
    ).reduce(
      (acc: Record<string, { count: number; total: string }>, row: Record<string, unknown>) => {
        acc[String(row._id)] = {
          count: Number(row.count),
          total: `GHS ${toMajorUnits(Number(row.totalMinor || 0)).toFixed(2)}`,
        };
        return acc;
      },
      {}
    );

    const summary = session.summary;
    const reportData = {
      sessionLabel: session.label,
      schoolName,
      sessionStatus: session.status,
      sourceTypes: session.sourceTypes,
      dateRange: session.dateRange,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      summary: {
        totalIngested: summary.totalIngested,
        matched: summary.matched,
        ambiguous: summary.ambiguous,
        unmatched: summary.unmatched,
        ignored: summary.ignored,
        paymentStatusUpdated: summary.paymentStatusUpdated,
        aiSuggestionsAccepted: summary.aiSuggestionsAccepted,
        aiSuggestionsRejected: summary.aiSuggestionsRejected,
        manualMatches: summary.manualMatches,
        matchRate:
          summary.totalIngested > 0
            ? Math.round((summary.matched / summary.totalIngested) * 100)
            : 0,
      },
      statusBreakdown,
      timelineEvents: session.timeline.length,
      notes,
    };

    let aiReport: {
      executiveSummary: string;
      sections: Array<{ title: string; content: string; highlights?: string[] }>;
      exceptions: string[];
      recommendations: string[];
    } | null = null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const prompt = `You are an experienced school finance auditor. Generate a professional reconciliation report based on this session data.

Session Data:
${JSON.stringify(reportData, null, 2)}

Respond ONLY with valid JSON:
{
  "executiveSummary": "2-3 sentence summary of the reconciliation session outcome",
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed paragraph with specific numbers",
      "highlights": ["Key point 1", "Key point 2"]
    }
  ],
  "exceptions": ["Any items or patterns that need attention from auditors"],
  "recommendations": ["Actionable recommendations for future reconciliation"]
}

Include sections for: Match Summary, Source Analysis, Exceptions & Risk, and Audit Trail.
Be specific with numbers. Flag any concerning patterns.
Write for an external auditor audience.`;

      try {
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an experienced school finance auditor. Always respond with valid JSON only, no markdown.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
          response_format: { type: "json_object" },
          max_tokens: 3000,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (responseText) {
          try {
            aiReport = JSON.parse(responseText);
          } catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) aiReport = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiError) {
        console.error("AI report generation failed:", aiError);
      }
    }

    const verificationId = await createVerificationId();
    const now = new Date();

    const verificationPayload = {
      verificationId,
      reportType: "reconciliation_report" as const,
      status: "issued" as const,
      schoolId: schoolIdObj,
      schoolName,
      issuedBy: userIdObj,
      reportLabel: `Reconciliation Report: ${session.label}`,
      range: {
        startDate: session.dateRange?.startDate || session.createdAt,
        endDate: session.dateRange?.endDate || session.completedAt || now,
        source: "reconciliation_session",
        periodLabel: session.label,
      },
      meta: {
        categories: ["finance", "reconciliation", "audit"],
        version: 1,
        rowCount: summary.totalIngested,
      },
      issuedAt: now,
    };

    try {
      await ReportVerification.create(verificationPayload);
    } catch (enumError) {
      await ReportVerification.collection.insertOne({
        ...verificationPayload,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ReconciliationSession.updateOne(
      { _id: session._id, schoolId: schoolIdObj },
      {
        $set: { reportVerificationId: verificationId },
        $push: {
          timeline: {
            action: "report_generated",
            userId: userIdObj,
            at: now,
            notes: notes || null,
            metadata: { verificationId, aiGenerated: Boolean(aiReport) },
          },
        },
      }
    );

    await recordActivity({
      schoolId: String(schoolIdObj),
      userId: String(userIdObj),
      type: "reconciliation.report_generated",
      entityType: "ReconciliationSession",
      entityId: session._id,
      description: `Generated reconciliation report for session: ${session.label}`,
      metadata: { verificationId },
    });

    return NextResponse.json({
      ok: true,
      data: {
        verificationId,
        report: aiReport || {
          executiveSummary: `Reconciliation session "${session.label}" processed ${summary.totalIngested} ingestion items with a ${reportData.summary.matchRate}% match rate. ${summary.ambiguous} items required manual review.`,
          sections: [
            {
              title: "Match Summary",
              content: `Out of ${summary.totalIngested} total ingested items, ${summary.matched} were matched, ${summary.ambiguous} were ambiguous, ${summary.unmatched} remained unmatched, and ${summary.ignored} were ignored. ${summary.paymentStatusUpdated} payment statuses were updated during this session.`,
              highlights: [
                `${reportData.summary.matchRate}% match rate`,
                `${summary.manualMatches} manual matches`,
                `${summary.aiSuggestionsAccepted} AI suggestions accepted`,
              ],
            },
          ],
          exceptions: summary.ambiguous > 0 ? [`${summary.ambiguous} ambiguous items may need further investigation`] : [],
          recommendations: [
            summary.unmatched > 0
              ? "Review unmatched items and ensure all payment references are captured at point of collection."
              : "All items were resolved. Maintain current reference capture practices.",
          ],
        },
        sessionSummary: reportData.summary,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    const message = error instanceof Error ? error.message : "Failed to generate report.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
