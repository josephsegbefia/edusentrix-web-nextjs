import OpenAI from "openai";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildPilotCloseoutFallbackSummary,
  buildPilotCloseoutSnapshot,
} from "@/lib/platform-billing/pilot-closeout";
import {
  getCurrentMonthRange,
  parseDateOnly,
} from "@/lib/platform-billing/period-range";
import { PilotCloseoutRun } from "@/models/PilotCloseoutRun";

async function generateAISummary(input: {
  schoolCount: number;
  summary: Record<string, number>;
  recommendations: Array<{
    schoolName: string;
    tierName?: string | null;
    currentSubscriptionPriceMinor: number;
    estimatedCostMinor: number;
    transactionFeeRevenueMinor: number;
    marginMinor: number;
    marginPercent: number;
    recommendedSubscriptionPriceMinor: number;
    recommendedAction: string;
  }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { content: null, model: null };
  }

  const model = process.env.OPENAI_PLATFORM_BILLING_MODEL || "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });
  const prompt = [
    "You are reviewing a SaaS pilot closeout pricing snapshot for a school management platform.",
    "Write a concise executive brief in plain English.",
    "Focus on margin risk, underpriced schools, and what should be approved or manually reviewed.",
    "Do not use bullets. Keep it to two short paragraphs.",
    "",
    JSON.stringify(input),
  ].join("\n");

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You produce concise operational pricing review briefs for SaaS administrators.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    content: completion.choices?.[0]?.message?.content?.trim() || null,
    model,
  };
}

export async function runPilotCloseoutJob(input?: {
  periodStart?: string | null;
  periodEnd?: string | null;
  actorId?: mongoose.Types.ObjectId | null;
  actorEmail?: string | null;
}) {
  await connectToDatabase();

  const defaultRange = getCurrentMonthRange();
  const periodStart =
    parseDateOnly(input?.periodStart) || defaultRange.periodStart;
  const periodEnd = parseDateOnly(input?.periodEnd) || defaultRange.periodEnd;

  if (periodEnd.getTime() < periodStart.getTime()) {
    throw new Error("Invalid pilot closeout period.");
  }

  const snapshot = await buildPilotCloseoutSnapshot({ periodStart, periodEnd });
  const aiResult = await generateAISummary({
    schoolCount: snapshot.schoolCount,
    summary: snapshot.summary,
    recommendations: snapshot.recommendations.slice(0, 8).map((item) => ({
      schoolName: item.schoolName,
      tierName: item.tierName || null,
      currentSubscriptionPriceMinor: item.currentSubscriptionPriceMinor,
      estimatedCostMinor: item.estimatedCostMinor,
      transactionFeeRevenueMinor: item.transactionFeeRevenueMinor,
      marginMinor: item.marginMinor,
      marginPercent: item.marginPercent,
      recommendedSubscriptionPriceMinor: item.recommendedSubscriptionPriceMinor,
      recommendedAction: item.recommendedAction,
    })),
  }).catch(() => ({ content: null, model: null }));

  const run = await PilotCloseoutRun.create({
    periodStart,
    periodEnd,
    approvalStatus: "pending_approval",
    generatedBy: input?.actorId || null,
    generatedByEmail: input?.actorEmail || null,
    aiSummary: aiResult.content || buildPilotCloseoutFallbackSummary(snapshot),
    aiModel: aiResult.model || null,
    schoolCount: snapshot.schoolCount,
    summary: snapshot.summary,
    recommendations: snapshot.recommendations,
  });

  return run;
}
