// src/app/api/demo/session/route.ts
// Demo session management - get status, refresh, end session

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import {
  getDemoSession,
  clearDemoSessionCookie,
  isDemoSessionValid,
  refreshDemoSession,
  setDemoSessionCookie,
  getRemainingSessionTime,
} from "@/lib/demo/session";
import { notifySessionEnded } from "@/lib/demo/notifications";
import { cleanupDemoTenant } from "@/lib/demo/cleanup";

/**
 * GET - Get current session status
 */
export async function GET() {
  try {
    const session = await getDemoSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    if (!isDemoSessionValid(session)) {
      await clearDemoSessionCookie();
      return NextResponse.json({
        authenticated: false,
        reason: "session_expired",
      });
    }

    const remaining = getRemainingSessionTime(session);

    return NextResponse.json({
      authenticated: true,
      session: {
        demoTenantId: session.demoTenantId,
        email: session.email,
        fullName: session.fullName,
        organization: session.organization,
        role: session.role,
      },
      remaining: {
        inactivitySeconds: remaining.inactivitySeconds,
        hardLimitSeconds: remaining.hardLimitSeconds,
      },
    });
  } catch (error) {
    console.error("[Demo Session GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to get session status" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Refresh session (extend inactivity timeout)
 */
export async function PATCH() {
  try {
    const session = await getDemoSession();

    if (!session) {
      return NextResponse.json(
        { error: "No active session" },
        { status: 401 }
      );
    }

    if (!isDemoSessionValid(session)) {
      await clearDemoSessionCookie();
      return NextResponse.json(
        { error: "Session expired" },
        { status: 401 }
      );
    }

    // Refresh session token
    const newToken = await refreshDemoSession(session);
    if (!newToken) {
      return NextResponse.json(
        { error: "Unable to refresh session" },
        { status: 401 }
      );
    }

    await setDemoSessionCookie(newToken);

    // Update last activity in database
    await connectToDatabase();
    await DemoSession.updateOne(
      { demoTenantId: session.demoTenantId },
      { $set: { lastActivityAt: new Date() } }
    );

    return NextResponse.json({ success: true, refreshed: true });
  } catch (error) {
    console.error("[Demo Session PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - End session explicitly
 */
export async function DELETE() {
  try {
    const sessionData = await getDemoSession();

    if (!sessionData) {
      return NextResponse.json({ success: true, message: "No session to end" });
    }

    await connectToDatabase();

    // Update session in database
    const session = await DemoSession.findOneAndUpdate(
      { demoTenantId: sessionData.demoTenantId },
      {
        $set: {
          status: "ended",
          endedAt: new Date(),
          endReason: "user_ended",
        },
        $push: {
          events: {
            type: "session_end",
            timestamp: new Date(),
            metadata: { reason: "user_ended" },
          },
        },
      },
      { new: true }
    );

    // Update lead status
    const lead = await DemoLead.findByIdAndUpdate(
      sessionData.leadId,
      {
        $set: { status: "session_completed" },
        $inc: { totalTimeSpentSeconds: session?.durationSeconds || 0 },
      },
      { new: true }
    );

    // Clear cookie
    await clearDemoSessionCookie();

    // Cleanup demo data
    await cleanupDemoTenant(sessionData.demoTenantId);

    // Notify sales (async)
    if (lead && session) {
      notifySessionEnded(
        {
          id: String(lead._id),
          email: lead.email,
          fullName: lead.fullName,
          organization: lead.organization,
          role: lead.role,
          schoolSize: lead.schoolSize,
          phone: lead.phone,
          country: lead.country,
          status: "session_completed",
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
          status: "ended",
          startedAt: session.startedAt.toISOString(),
          lastActivityAt: session.lastActivityAt.toISOString(),
          endedAt: session.endedAt?.toISOString(),
          endReason: session.endReason,
          events: session.events.map((e) => ({
            type: e.type,
            timestamp: e.timestamp.toISOString(),
            metadata: e.metadata,
          })),
          pagesVisited: session.pagesVisited,
          actionsAttempted: session.actionsAttempted,
          durationSeconds: session.durationSeconds,
        }
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      message: "Session ended successfully",
    });
  } catch (error) {
    console.error("[Demo Session DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 }
    );
  }
}
