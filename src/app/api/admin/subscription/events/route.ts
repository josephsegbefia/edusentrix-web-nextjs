/**
 * GET /api/admin/subscription/events
 *
 * School admin's own subscription event log. Read-only.
 * Excludes internal platform metadata from each event.
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

const EXCLUDED_EVENT_TYPES = ["entitlement_audit", "usage_event"];

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") ?? "15", 10)));
  const skip = (page - 1) * limit;

  const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
  const filter = {
    schoolId: schoolIdObj,
    eventType: { $nin: EXCLUDED_EVENT_TYPES },
  };

  const [events, total] = await Promise.all([
    SubscriptionEvent.find(filter)
      .select("eventType summary actorEmail createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SubscriptionEvent.countDocuments(filter),
  ]);

  return NextResponse.json({
    success: true,
    data: events.map((e) => ({
      _id: String(e._id),
      eventType: e.eventType,
      summary: e.summary,
      actorEmail: e.actorEmail ?? null,
      createdAt: e.createdAt,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
