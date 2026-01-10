// src/app/api/demo/track/route.ts
// Track demo user events for analytics and high-intent signals

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import { getDemoSession, isDemoSessionValid } from "@/lib/demo/session";
import { notifyHighIntent } from "@/lib/demo/notifications";
import { HIGH_INTENT_SIGNALS } from "@/lib/demo/config";

// Events that trigger high-intent alerts
const HIGH_INTENT_EVENTS: Record<string, string> = {
  "view_pricing": "viewed_pricing",
  "invoice_create": "attempted_invoice_create",
  "bulk_import": "attempted_bulk_import",
  "contact_sales": "clicked_contact_sales",
  "schedule_demo": "clicked_schedule_demo",
};

export async function POST(req: NextRequest) {
  try {
    const sessionData = await getDemoSession();
    if (!sessionData || !isDemoSessionValid(sessionData)) {
      return NextResponse.json({ error: "No valid session" }, { status: 401 });
    }

    const body = await req.json();
    const { type, metadata } = body;

    if (!type) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    await connectToDatabase();

    // Update session with event
    const session = await DemoSession.findOneAndUpdate(
      { demoTenantId: sessionData.demoTenantId },
      {
        $set: { lastActivityAt: new Date() },
        $push: {
          events: {
            type,
            timestamp: new Date(),
            metadata: metadata || {},
          },
        },
        $addToSet: {
          pagesVisited: type === "page_view" ? metadata?.path : undefined,
          actionsAttempted: type === "action_attempted" || type === "action_blocked" ? metadata?.action : undefined,
        },
      },
      { new: true }
    );

    // Update lead with features explored
    const lead = await DemoLead.findByIdAndUpdate(
      sessionData.leadId,
      {
        $addToSet: {
          featuresExplored: type === "feature_explore" ? metadata?.feature : undefined,
        },
      },
      { new: true }
    );

    // Check for high-intent signals
    const action = metadata?.action || metadata?.cta || metadata?.path;
    const signalKey = Object.keys(HIGH_INTENT_EVENTS).find((k) => action?.includes(k));

    if (signalKey && lead && session) {
      const signal = HIGH_INTENT_EVENTS[signalKey];

      // Add signal if not already recorded
      if (!lead.highIntentSignals.includes(signal)) {
        lead.highIntentSignals.push(signal);
        await lead.save();

        // Check if we should send a high-intent alert
        // Send alert if this is the first high-intent signal or if they have 3+ signals
        if (lead.highIntentSignals.length === 1 || lead.highIntentSignals.length === 3) {
          notifyHighIntent(
            {
              id: String(lead._id),
              email: lead.email,
              fullName: lead.fullName,
              organization: lead.organization,
              role: lead.role,
              schoolSize: lead.schoolSize,
              phone: lead.phone,
              country: lead.country,
              status: lead.status,
              sessionsCount: lead.sessionsCount,
              totalTimeSpentSeconds: lead.totalTimeSpentSeconds,
              featuresExplored: lead.featuresExplored,
              highIntentSignals: lead.highIntentSignals,
              createdAt: lead.createdAt.toISOString(),
              updatedAt: lead.updatedAt.toISOString(),
            },
            {
              id: String(session._id),
              demoTenantId: session.demoTenantId,
              leadId: String(session.leadId),
              status: session.status,
              startedAt: session.startedAt.toISOString(),
              lastActivityAt: session.lastActivityAt.toISOString(),
              events: session.events.map((e: { type: "session_start" | "page_view" | "feature_explore" | "action_attempted" | "action_blocked" | "cta_click" | "session_end"; timestamp: Date; metadata: Record<string, unknown> }) => ({
                type: e.type,
                timestamp: e.timestamp.toISOString(),
                metadata: e.metadata,
              })),
              pagesVisited: session.pagesVisited,
              actionsAttempted: session.actionsAttempted,
              durationSeconds: session.durationSeconds,
            },
            lead.highIntentSignals
          ).catch(console.error);
        }
      }
    }

    // Check for session duration high-intent (30 minutes)
    if (session && session.durationSeconds >= 30 * 60 && lead) {
      if (!lead.highIntentSignals.includes("session_duration_30min")) {
        lead.highIntentSignals.push("session_duration_30min");
        await lead.save();
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Demo Track] Error:", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500 });
  }
}
