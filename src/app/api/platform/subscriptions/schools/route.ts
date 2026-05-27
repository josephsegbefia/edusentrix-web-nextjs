/**
 * GET /api/platform/subscriptions/schools
 *
 * Paginated list of all school subscriptions with filter support.
 * Spec §14.4.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { School } from "@/models/School";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.success) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

  const perm = await requirePlatformPermission(auth.userId, "platform.billing.read");
  if (!perm.success) return NextResponse.json({ success: false, error: perm.error }, { status: 403 });

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10)));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") ?? null;
  const tierCode = url.searchParams.get("tierCode") ?? null;
  const search = url.searchParams.get("search") ?? null;
  const expiringSoon = url.searchParams.get("expiringSoon") === "true";
  const hasOverride = url.searchParams.get("hasOverride") === "true";

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Build filter
  const subFilter: Record<string, unknown> = {};
  if (status) subFilter.status = status;
  if (tierCode) subFilter.tierCode = tierCode;
  if (expiringSoon) subFilter.endsAt = { $gte: now, $lte: in30Days };
  if (hasOverride) subFilter.manualPriceOverrideMinor = { $ne: null };

  const [subs, total] = await Promise.all([
    SchoolSubscription.find(subFilter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        schoolId: mongoose.Types.ObjectId;
        tierCode?: string | null;
        tierName?: string | null;
        status: string;
        endsAt?: Date | null;
        pilotEndsAt?: Date | null;
        effectivePriceMinor: number;
        manualPriceOverrideMinor?: number | null;
        manualAccessModeOverride?: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>>(),
    SchoolSubscription.countDocuments(subFilter),
  ]);

  // Fetch school names
  const schoolIds = subs.map((s) => s.schoolId);
  let schoolNameMap: Record<string, { name: string; status?: string }> = {};

  if (schoolIds.length > 0) {
    const schools = await School.find({ _id: { $in: schoolIds } })
      .select("name status")
      .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string; status?: string }>>()
      .then((a) => a);

    // Apply search filter if provided
    const matchedIds = search
      ? new Set(schools.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase())).map((s) => String(s._id)))
      : null;

    for (const s of schools) {
      if (!matchedIds || matchedIds.has(String(s._id))) {
        schoolNameMap[String(s._id)] = { name: s.name ?? "Unknown", status: s.status };
      }
    }
  }

  // Filter by search if applied
  const filteredSubs = search
    ? subs.filter((s) => Boolean(schoolNameMap[String(s.schoolId)]))
    : subs;

  return NextResponse.json({
    success: true,
    data: filteredSubs.map((s) => ({
      _id: String(s._id),
      schoolId: String(s.schoolId),
      schoolName: schoolNameMap[String(s.schoolId)]?.name ?? "Unknown",
      tierCode: s.tierCode,
      tierName: s.tierName,
      status: s.status,
      endsAt: s.endsAt?.toISOString() ?? null,
      pilotEndsAt: s.pilotEndsAt?.toISOString() ?? null,
      effectivePriceMinor: s.effectivePriceMinor,
      hasOverride: s.manualPriceOverrideMinor != null,
      hasAccessOverride: s.manualAccessModeOverride != null,
      updatedAt: s.updatedAt.toISOString(),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
