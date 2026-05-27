/**
 * GET  /api/admin/admissions/cycles/[cycleId]/fee-settings  — fetch cycle fee settings
 * PATCH /api/admin/admissions/cycles/[cycleId]/fee-settings — update fee settings
 *
 * Also resolves the effective charge policy for this cycle + amount.
 * Spec §18.3.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";

type Params = { params: Promise<{ cycleId: string }> };

const PatchSchema = z.object({
  platformChargeBpsOverride: z.number().int().min(0).max(10000).nullable().optional(),
  payerModeOverride: z.enum(["payer_pays", "school_absorbs", "waived"]).nullable().optional(),
  overrideNote: z.string().trim().max(300).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const ctx = await requireAdmissionsManager();
  const { cycleId } = await params;

  if (!mongoose.Types.ObjectId.isValid(cycleId)) {
    return NextResponse.json({ success: false, error: "Invalid cycle ID." }, { status: 400 });
  }

  await connectToDatabase();

  const cycle = await AdmissionCycle.findOne({
    _id: cycleId,
    schoolId: ctx.schoolId,
  })
    .select("feeSettings applicationFee")
    .lean<{
      feeSettings?: { platformChargeBpsOverride?: number | null; payerModeOverride?: string | null; overrideNote?: string | null; updatedAt?: Date } | null;
      applicationFee?: { enabled?: boolean; amountMinor?: number; currency?: string; mode?: string } | null;
    }>();

  if (!cycle) {
    return NextResponse.json({ success: false, error: "Cycle not found." }, { status: 404 });
  }

  // Optionally resolve effective policy for the application fee amount
  let effectiveCharge: null | {
    chargeMinor: number;
    payerMode: string;
    totalPayable: number;
    source: "cycle_override" | "global_policy" | "none";
  } = null;

  if (cycle.applicationFee?.enabled && cycle.applicationFee?.amountMinor) {
    const amt = cycle.applicationFee.amountMinor;

    if (cycle.feeSettings?.platformChargeBpsOverride != null) {
      const chargeMinor = Math.round((amt * cycle.feeSettings.platformChargeBpsOverride) / 10000);
      const payerMode = cycle.feeSettings.payerModeOverride ?? "payer_pays";
      effectiveCharge = {
        chargeMinor,
        payerMode,
        totalPayable: payerMode === "payer_pays" ? amt + chargeMinor : amt,
        source: "cycle_override",
      };
    } else {
      // Resolve from global policy
      const { resolvePaymentChargePolicy } = await import("@/lib/subscriptions/resolve-payment-charge-policy");
      const resolved = await resolvePaymentChargePolicy({
        schoolId: ctx.schoolId,
        category: "admission_fee",
        amountMinor: amt,
      });
      effectiveCharge = {
        chargeMinor: resolved.chargeMinor,
        payerMode: resolved.payerMode,
        totalPayable: resolved.totalPayableMinor,
        source: resolved.found ? "global_policy" : "none",
      };
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      feeSettings: cycle.feeSettings ?? null,
      applicationFee: cycle.applicationFee ?? null,
      effectiveCharge,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireAdmissionsManager();
  const { cycleId } = await params;

  if (!mongoose.Types.ObjectId.isValid(cycleId)) {
    return NextResponse.json({ success: false, error: "Invalid cycle ID." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  await connectToDatabase();

  const update: Record<string, unknown> = {};
  if (parsed.data.platformChargeBpsOverride !== undefined) {
    update["feeSettings.platformChargeBpsOverride"] = parsed.data.platformChargeBpsOverride;
  }
  if (parsed.data.payerModeOverride !== undefined) {
    update["feeSettings.payerModeOverride"] = parsed.data.payerModeOverride;
  }
  if (parsed.data.overrideNote !== undefined) {
    update["feeSettings.overrideNote"] = parsed.data.overrideNote;
  }
  update["feeSettings.updatedAt"] = new Date();

  const cycle = await AdmissionCycle.findOneAndUpdate(
    { _id: cycleId, schoolId: ctx.schoolId },
    { $set: update },
    { new: true }
  ).select("feeSettings applicationFee").lean();

  if (!cycle) {
    return NextResponse.json({ success: false, error: "Cycle not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: cycle });
}
