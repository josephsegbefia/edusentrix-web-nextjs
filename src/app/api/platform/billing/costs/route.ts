import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import {
  PLATFORM_BILLING_PROVIDER_LABELS,
  PLATFORM_BILLING_PROVIDERS,
} from "@/lib/platform-billing/providers";
import {
  getCurrentMonthRange,
  parseDateOnly,
} from "@/lib/platform-billing/period-range";
import { ServiceCostEntry } from "@/models/ServiceCostEntry";
import { User } from "@/models/User";

const CostEntrySchema = z.object({
  provider: z.enum(PLATFORM_BILLING_PROVIDERS),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(160).nullable().optional().default(null),
  amountMinor: z.number().int().min(0),
  currency: z.string().trim().min(3).max(8).default("GHS"),
  allocationMethod: z.enum(["shared", "direct", "n_a"]),
  sourceType: z.enum(["manual", "provider_sync", "invoice_import"]).default("manual"),
  periodStart: z.string().trim().min(1),
  periodEnd: z.string().trim().min(1),
  notes: z.string().trim().max(240).nullable().optional().default(null),
});

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const periodStart =
      parseDateOnly(req.nextUrl.searchParams.get("periodStart")) ||
      getCurrentMonthRange().periodStart;
    const periodEnd =
      parseDateOnly(req.nextUrl.searchParams.get("periodEnd")) ||
      getCurrentMonthRange().periodEnd;

    const entries = await ServiceCostEntry.find({
      periodStart: { $gte: periodStart },
      periodEnd: { $lte: periodEnd },
    })
      .sort({ periodStart: -1, createdAt: -1 })
      .lean();

    const totalsByProvider = new Map<string, number>();
    let totalAmountMinor = 0;
    for (const entry of entries) {
      const amountMinor = Number(entry.amountMinor || 0);
      totalAmountMinor += amountMinor;
      totalsByProvider.set(
        entry.provider,
        (totalsByProvider.get(entry.provider) || 0) + amountMinor
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        totalAmountMinor,
        providers: Array.from(totalsByProvider.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([provider, amountMinor]) => ({
            provider,
            label:
              PLATFORM_BILLING_PROVIDER_LABELS[
                provider as keyof typeof PLATFORM_BILLING_PROVIDER_LABELS
              ] || provider,
            amountMinor,
          })),
        entries: entries.map((entry) => ({
          id: String(entry._id),
          provider: entry.provider,
          providerLabel:
            PLATFORM_BILLING_PROVIDER_LABELS[
              entry.provider as keyof typeof PLATFORM_BILLING_PROVIDER_LABELS
            ] || entry.provider,
          category: entry.category,
          description: entry.description || null,
          amountMinor: Number(entry.amountMinor || 0),
          currency: entry.currency || "GHS",
          allocationMethod: entry.allocationMethod,
          sourceType: entry.sourceType,
          periodStart: entry.periodStart.toISOString().slice(0, 10),
          periodEnd: entry.periodEnd.toISOString().slice(0, 10),
          notes: entry.notes || null,
          createdByEmail: entry.createdByEmail || null,
          updatedAt: entry.updatedAt?.toISOString?.() || null,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load service cost entries:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load service costs",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const body = CostEntrySchema.parse(await req.json());
    const [actor, periodStart, periodEnd] = [
      await User.findById(gate.me._id).select("email").lean<{ email?: string } | null>(),
      parseDateOnly(body.periodStart),
      parseDateOnly(body.periodEnd),
    ];

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { success: false, error: "Invalid billing period." },
        { status: 400 }
      );
    }

    const created = await ServiceCostEntry.create({
      provider: body.provider,
      category: body.category,
      description: body.description,
      amountMinor: body.amountMinor,
      currency: body.currency,
      allocationMethod: body.allocationMethod,
      sourceType: body.sourceType,
      periodStart,
      periodEnd,
      notes: body.notes,
      createdBy: gate.me._id,
      createdByEmail: actor?.email || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(created._id),
        provider: created.provider,
        providerLabel: PLATFORM_BILLING_PROVIDER_LABELS[created.provider],
        category: created.category,
        amountMinor: created.amountMinor,
        periodStart: created.periodStart.toISOString().slice(0, 10),
        periodEnd: created.periodEnd.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Invalid service cost payload." },
        { status: 400 }
      );
    }

    console.error("Failed to create service cost entry:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create service cost entry",
      },
      { status: 500 }
    );
  }
}
