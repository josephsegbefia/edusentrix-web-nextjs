// src/app/api/demo/signup/route.ts
// Demo signup endpoint - captures lead info and sends magic link

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoLead } from "@/models/DemoLead";
import {
  DEMO_SESSION,
  DEMO_RATE_LIMITS,
  isEmailDomainBlocked,
  generateMagicLinkToken,
} from "@/lib/demo/config";
import { sendDemoMagicLink } from "@/lib/demo/notifications";

const { APP_URL } = process.env;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, fullName, organization, role, schoolSize, phone, country } = body;

    // Validate required fields
    if (!email || !fullName || !organization || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, fullName, organization, role" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check for disposable email domains
    if (isEmailDomainBlocked(email)) {
      return NextResponse.json(
        { error: "Please use a valid work or school email address" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ["admin", "teacher", "finance", "it", "other"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check rate limits - email cooldown
    const emailLower = email.toLowerCase();
    const cooldownCutoff = new Date(Date.now() - DEMO_RATE_LIMITS.EMAIL_COOLDOWN_MS);

    const recentLead = await DemoLead.findOne({
      email: emailLower,
      $or: [
        { status: { $in: ["session_active", "session_completed"] } },
        { lastSessionAt: { $gte: cooldownCutoff } },
      ],
    });

    if (recentLead) {
      // Returning visitor - redirect to schedule a call
      return NextResponse.json(
        {
          error: "returning_visitor",
          message: "You have already used your demo. Please schedule a call with our sales team.",
          scheduleUrl: `${APP_URL}/demo/schedule-call?email=${encodeURIComponent(emailLower)}`,
        },
        { status: 409 }
      );
    }

    // Check IP rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";

    const ipCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ipCount = await DemoLead.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: ipCutoff },
    });

    if (ipCount >= DEMO_RATE_LIMITS.MAX_PER_IP_24H) {
      return NextResponse.json(
        { error: "Too many demo requests. Please try again later." },
        { status: 429 }
      );
    }

    // Generate magic link token
    const magicLinkToken = generateMagicLinkToken();
    const magicLinkExpiresAt = new Date(Date.now() + DEMO_SESSION.MAGIC_LINK_EXPIRY_MS);

    // Create or update lead
    const lead = await DemoLead.findOneAndUpdate(
      { email: emailLower },
      {
        $set: {
          fullName: fullName.trim(),
          organization: organization.trim(),
          role,
          schoolSize,
          phone: phone?.trim(),
          country: country?.trim(),
          ipAddress: ip,
          magicLinkToken,
          magicLinkExpiresAt,
          status: "pending_verification",
        },
        $setOnInsert: {
          email: emailLower,
          sessionsCount: 0,
          totalTimeSpentSeconds: 0,
          featuresExplored: [],
          highIntentSignals: [],
        },
      },
      { upsert: true, new: true }
    );

    // Send magic link email
    const magicLink = `${APP_URL}/demo/verify?token=${magicLinkToken}`;
    await sendDemoMagicLink(emailLower, fullName.trim(), magicLink);

    return NextResponse.json({
      success: true,
      message: "Check your email for the magic link to access your demo.",
      leadId: String(lead._id),
    });
  } catch (error) {
    console.error("[Demo Signup] Error:", error);
    return NextResponse.json(
      { error: "Failed to process demo signup" },
      { status: 500 }
    );
  }
}
