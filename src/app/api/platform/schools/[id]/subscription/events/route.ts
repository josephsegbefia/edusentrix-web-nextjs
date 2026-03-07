import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { SubscriptionEvent } from "@/models/SubscriptionEvent";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id." },
        { status: 400 }
      );
    }

    const schoolId = new mongoose.Types.ObjectId(id);
    const events = await SubscriptionEvent.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        schoolId: id,
        events: events.map((event) => ({
          id: String(event._id),
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
    console.error("Failed to load school subscription events:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load school subscription events",
      },
      { status: 500 }
    );
  }
}
