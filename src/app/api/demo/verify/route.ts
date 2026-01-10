// src/app/api/demo/verify/route.ts
// Magic link verification - creates demo session and seeds data

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import { generateDemoTenantId, DEMO_SESSION } from "@/lib/demo/config";
import { createDemoSessionToken } from "@/lib/demo/session";
import { notifyNewDemoSignup } from "@/lib/demo/notifications";
import { seedDemoData } from "@/lib/demo/seeder";

function getAppUrl(req: NextRequest): string {
  // Use request origin for correct URL in all environments
  const origin = req.nextUrl.origin;
  return process.env.APP_URL || origin;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = getAppUrl(req);

  if (!token) {
    return NextResponse.redirect(new URL("/demo?error=invalid_token", appUrl));
  }

  try {
    await connectToDatabase();

    // Find lead with valid magic link
    const lead = await DemoLead.findOne({
      magicLinkToken: token,
      magicLinkExpiresAt: { $gt: new Date() },
    });

    if (!lead) {
      return NextResponse.redirect(
        new URL("/demo?error=expired_or_invalid", appUrl)
      );
    }

    // Check if lead already has an active session
    const existingSession = await DemoSession.findOne({
      leadId: lead._id,
      status: "active",
    });

    let demoTenantId: string;
    let isNewSession = false;

    if (existingSession) {
      // Resume existing session
      demoTenantId = existingSession.demoTenantId;
    } else {
      // Generate unique tenant ID for this session
      demoTenantId = generateDemoTenantId();
      isNewSession = true;

      // Create demo session record
      const session = await DemoSession.create({
        demoTenantId,
        leadId: lead._id,
        status: "active",
        startedAt: new Date(),
        lastActivityAt: new Date(),
        events: [
          {
            type: "session_start",
            timestamp: new Date(),
            metadata: { source: "magic_link" },
          },
        ],
        pagesVisited: [],
        actionsAttempted: [],
      });

      // Seed demo data for this tenant
      const seedResult = await seedDemoData(demoTenantId, {
        organizationName: lead.organization,
        adminName: lead.fullName,
        adminEmail: lead.email,
      });

      // Update session with school reference
      if (seedResult.schoolId) {
        session.schoolId = seedResult.schoolId;
        await session.save();
      }

      // Update lead status
      await DemoLead.findByIdAndUpdate(lead._id, {
        $set: {
          status: "session_active",
          verifiedAt: new Date(),
          lastSessionAt: new Date(),
          magicLinkToken: undefined,
          magicLinkExpiresAt: undefined,
        },
        $inc: { sessionsCount: 1 },
      });
    }

    // Create session JWT
    const sessionToken = await createDemoSessionToken({
      demoTenantId,
      leadId: String(lead._id),
      email: lead.email,
      fullName: lead.fullName,
      organization: lead.organization,
      role: lead.role,
    });

    // Create redirect response and set cookie on the response
    const response = NextResponse.redirect(new URL("/demo/admin", appUrl));

    response.cookies.set(DEMO_SESSION.COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: DEMO_SESSION.COOKIE_MAX_AGE,
      path: "/",
    });

    // Notify sales team (async, don't block) - only for new sessions
    if (isNewSession) {
      notifyNewDemoSignup({
        id: String(lead._id),
        email: lead.email,
        fullName: lead.fullName,
        organization: lead.organization,
        role: lead.role,
        schoolSize: lead.schoolSize,
        phone: lead.phone,
        country: lead.country,
        status: "session_active",
        sessionsCount: lead.sessionsCount + 1,
        totalTimeSpentSeconds: lead.totalTimeSpentSeconds,
        featuresExplored: lead.featuresExplored,
        highIntentSignals: lead.highIntentSignals,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }).catch(console.error);
    }

    return response;
  } catch (error) {
    console.error("[Demo Verify] Error:", error);
    return NextResponse.redirect(new URL("/demo?error=server_error", appUrl));
  }
}
