import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  executePlatformBillingProviderSyncRun,
  getProviderSyncCatalog,
} from "@/lib/platform-billing/provider-sync";
import { parseDateOnly } from "@/lib/platform-billing/period-range";
import { ProviderSyncRun } from "@/models/ProviderSyncRun";
import { User } from "@/models/User";

const RunProviderSyncSchema = z.object({
  provider: z.enum([
    "clerk",
    "mongodb",
    "vercel",
    "openai",
    "uploadthing",
    "paystack",
    "email",
    "storage",
    "internal",
  ]),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
});

type ProviderSyncRunRow = {
  _id: mongoose.Types.ObjectId;
  provider: string;
  status: "running" | "completed" | "failed";
  triggerMode: "manual" | "scheduled";
  periodStart: Date;
  periodEnd: Date;
  metricsUpserted?: number;
  costEntriesUpserted?: number;
  triggeredByEmail?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  startedAt: Date;
  completedAt?: Date | null;
  createdAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const provider = req.nextUrl.searchParams.get("provider");
    const filter =
      provider && provider !== "all"
        ? {
            provider,
          }
        : {};

    const runs = await ProviderSyncRun.find(filter)
      .sort({ createdAt: -1 })
      .limit(40)
      .lean<ProviderSyncRunRow[]>();

    return NextResponse.json({
      success: true,
      data: {
        providers: getProviderSyncCatalog(),
        runs: runs.map((run) => ({
          id: String(run._id),
          provider: run.provider,
          status: run.status,
          triggerMode: run.triggerMode,
          periodStart: run.periodStart.toISOString().slice(0, 10),
          periodEnd: run.periodEnd.toISOString().slice(0, 10),
          metricsUpserted: Number(run.metricsUpserted || 0),
          costEntriesUpserted: Number(run.costEntriesUpserted || 0),
          triggeredByEmail: run.triggeredByEmail || null,
          summary: run.summary || null,
          errorMessage: run.errorMessage || null,
          metadata: run.metadata || null,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load provider sync runs:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load provider sync runs",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = RunProviderSyncSchema.parse(await req.json());
    const periodStart = parseDateOnly(body.periodStart);
    const periodEnd = parseDateOnly(body.periodEnd);

    if (!periodStart || !periodEnd || periodEnd.getTime() < periodStart.getTime()) {
      return NextResponse.json(
        { success: false, error: "Invalid sync period." },
        { status: 400 }
      );
    }

    const actor = await User.findById(gate.me._id)
      .select("email")
      .lean<{ email?: string } | null>();

    const result = await executePlatformBillingProviderSyncRun({
      provider: body.provider,
      periodStart,
      periodEnd,
      triggerMode: "manual",
      actor: {
        userId: gate.me._id,
        email: actor?.email || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        runId: result.runId,
        provider: result.provider,
        metricsUpserted: result.metricsUpserted,
        costEntriesUpserted: result.costEntriesUpserted,
        summary: result.summary,
        metadata: result.metadata || null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid provider sync payload." },
        { status: 400 }
      );
    }

    console.error("Failed to run provider sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run provider sync",
      },
      { status: 500 }
    );
  }
}
