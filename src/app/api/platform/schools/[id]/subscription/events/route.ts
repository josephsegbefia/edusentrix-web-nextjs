/**
 * GET /api/platform/schools/[id]/subscription/events
 *
 * Paginated subscription event log for a school.
 * Platform-admin only. Requires platform.billing.read.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const perm = await requirePlatformPermission("platform.billing.read");
  if (!perm.ok) return perm.res;

  const { id: schoolId } = await params;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid school ID." }, { status: 400 });
  }

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const eventType = url.searchParams.get("eventType") ?? null;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { schoolId: new mongoose.Types.ObjectId(schoolId) };
  if (eventType) filter.eventType = eventType;

  const [events, total] = await Promise.all([
    SubscriptionEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SubscriptionEvent.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({
      ...e,
      _id: String(e._id),
      schoolId: String(e.schoolId),
      subscriptionId: e.subscriptionId ? String(e.subscriptionId) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
