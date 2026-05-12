import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UsageEvent, type UsageEventCategory } from "@/models/UsageEvent";
import type { PlatformBillingProvider } from "@/lib/platform-billing/providers";

function normalizeSchoolId(schoolId: string | mongoose.Types.ObjectId) {
  return typeof schoolId === "string"
    ? new mongoose.Types.ObjectId(schoolId)
    : schoolId;
}

export async function recordUsageEvent(input: {
  schoolId: string | mongoose.Types.ObjectId;
  provider: PlatformBillingProvider;
  category: UsageEventCategory;
  metricKey: string;
  quantity?: number;
  unitLabel?: string;
  unitCostMinor?: number;
  estimatedCostMinor?: number;
  actorId?: mongoose.Types.ObjectId | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}) {
  await connectToDatabase();

  return UsageEvent.create(buildUsageEventDocument(input));
}

export function buildUsageEventDocument(input: {
  schoolId: string | mongoose.Types.ObjectId;
  provider: PlatformBillingProvider;
  category: UsageEventCategory;
  metricKey: string;
  quantity?: number;
  unitLabel?: string;
  unitCostMinor?: number;
  estimatedCostMinor?: number;
  actorId?: mongoose.Types.ObjectId | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: mongoose.Types.ObjectId | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}) {
  const quantity = Math.max(0, Number(input.quantity || 1));
  const unitCostMinor = Math.max(0, Math.round(Number(input.unitCostMinor || 0)));
  const estimatedCostMinor =
    input.estimatedCostMinor !== undefined
      ? Math.max(0, Math.round(Number(input.estimatedCostMinor || 0)))
      : Math.max(0, Math.round(quantity * unitCostMinor));

  return {
    schoolId: normalizeSchoolId(input.schoolId),
    provider: input.provider,
    category: input.category,
    metricKey: input.metricKey,
    quantity,
    unitLabel: input.unitLabel || "units",
    unitCostMinor,
    estimatedCostMinor,
    actorId: input.actorId || null,
    actorEmail: input.actorEmail || null,
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    periodStart: input.periodStart || null,
    periodEnd: input.periodEnd || null,
    metadata: input.metadata || null,
    notes: input.notes || null,
  };
}
