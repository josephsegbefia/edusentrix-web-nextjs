import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { runPilotCloseoutJob } from "@/lib/jobs/pilotCloseout";
import { PilotCloseoutRun } from "@/models/PilotCloseoutRun";
import { User } from "@/models/User";

const GeneratePilotCloseoutSchema = z.object({
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
});

export async function GET() {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const rows = await PilotCloseoutRun.find({})
      .sort({ createdAt: -1 })
      .limit(12)
      .lean();

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        id: String(row._id),
        periodStart: row.periodStart.toISOString().slice(0, 10),
        periodEnd: row.periodEnd.toISOString().slice(0, 10),
        approvalStatus: row.approvalStatus,
        generatedByEmail: row.generatedByEmail || null,
        reviewedByEmail: row.reviewedByEmail || null,
        reviewedAt: row.reviewedAt?.toISOString?.() || null,
        reviewNote: row.reviewNote || null,
        aiSummary: row.aiSummary || null,
        aiModel: row.aiModel || null,
        schoolCount: row.schoolCount,
        summary: row.summary,
        recommendations: row.recommendations.map((item) => ({
          schoolId: String(item.schoolId),
          schoolName: item.schoolName,
          subscriptionId: item.subscriptionId ? String(item.subscriptionId) : null,
          tierName: item.tierName || null,
          subscriptionStatus: item.subscriptionStatus || null,
          currentSubscriptionPriceMinor: item.currentSubscriptionPriceMinor,
          transactionFeeRevenueMinor: item.transactionFeeRevenueMinor,
          estimatedCostMinor: item.estimatedCostMinor,
          realizedRevenueMinor: item.realizedRevenueMinor,
          marginMinor: item.marginMinor,
          marginPercent: item.marginPercent,
          recommendedSubscriptionPriceMinor: item.recommendedSubscriptionPriceMinor,
          recommendedAction: item.recommendedAction,
          narrative: item.narrative,
        })),
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to load pilot closeout runs:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load pilot closeout runs",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const payload = GeneratePilotCloseoutSchema.parse(await req.json());
    const actor = await User.findById(gate.me._id)
      .select("email")
      .lean<{ email?: string } | null>();

    const run = await runPilotCloseoutJob({
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      actorId: gate.me._id,
      actorEmail: actor?.email || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(run._id),
        approvalStatus: run.approvalStatus,
        aiSummary: run.aiSummary || null,
        aiModel: run.aiModel || null,
        schoolCount: run.schoolCount,
        summary: run.summary,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid pilot closeout payload." },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Invalid pilot closeout period.") {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error("Failed to generate pilot closeout run:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate pilot closeout run",
      },
      { status: 500 }
    );
  }
}
