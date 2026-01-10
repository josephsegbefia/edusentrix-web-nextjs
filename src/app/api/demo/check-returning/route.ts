// src/app/api/demo/check-returning/route.ts
// Check if an email has already used the demo

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoLead } from "@/models/DemoLead";
import { DEMO_RATE_LIMITS } from "@/lib/demo/config";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await connectToDatabase();

    const emailLower = email.toLowerCase();
    const cooldownCutoff = new Date(Date.now() - DEMO_RATE_LIMITS.EMAIL_COOLDOWN_MS);

    // Check if returning visitor
    const existingLead = await DemoLead.findOne({
      email: emailLower,
      $or: [
        { status: { $in: ["session_active", "session_completed"] } },
        { lastSessionAt: { $gte: cooldownCutoff } },
      ],
    }).lean();

    if (existingLead) {
      return NextResponse.json({
        isReturning: true,
        hasActiveSession: existingLead.status === "session_active",
        lastSessionAt: existingLead.lastSessionAt,
        sessionsCount: existingLead.sessionsCount,
      });
    }

    return NextResponse.json({
      isReturning: false,
    });
  } catch (error) {
    console.error("[Demo Check Returning] Error:", error);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 }
    );
  }
}
