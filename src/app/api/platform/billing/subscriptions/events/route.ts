import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { School } from "@/models/School";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

type SchoolRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  status?: string;
};

type SubscriptionEventRow = {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  eventType: string;
  actorEmail?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const schoolId = req.nextUrl.searchParams.get("schoolId");
    const limitValue = Number(req.nextUrl.searchParams.get("limit") || 60);
    const limit = Math.min(
      200,
      Number.isFinite(limitValue) && limitValue > 0 ? Math.floor(limitValue) : 60
    );

    if (schoolId && !mongoose.Types.ObjectId.isValid(schoolId)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const filter = schoolId
      ? { schoolId: new mongoose.Types.ObjectId(schoolId) }
      : {};

    const [schools, events] = await Promise.all([
      School.find({}).select("name status").sort({ name: 1 }).lean<SchoolRow[]>(),
      SubscriptionEvent.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<SubscriptionEventRow[]>(),
    ]);

    const schoolNameMap = new Map(
      schools.map((school) => [String(school._id), school.name || "Unnamed School"])
    );

    return NextResponse.json({
      success: true,
      data: {
        schools: schools.map((school) => ({
          id: String(school._id),
          name: school.name || "Unnamed School",
          status: school.status || "pending",
        })),
        events: events.map((event) => ({
          id: String(event._id),
          schoolId: String(event.schoolId),
          schoolName: schoolNameMap.get(String(event.schoolId)) || "Unnamed School",
          subscriptionId: String(event.subscriptionId),
          eventType: event.eventType,
          actorEmail: event.actorEmail || null,
          summary: event.summary,
          metadata: event.metadata || null,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load subscription events:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load subscription events",
      },
      { status: 500 }
    );
  }
}
