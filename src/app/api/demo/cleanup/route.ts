// src/app/api/demo/cleanup/route.ts
// Cron job endpoint for cleaning up stale demo sessions
// Should be called periodically (e.g., every hour via Vercel Cron or external service)

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { cleanupStaleDemoSessions } from "@/lib/demo/cleanup";

// Secret key to protect the endpoint
const CRON_SECRET = process.env.CRON_SECRET || process.env.DEMO_CRON_SECRET;

export async function POST(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = authHeader?.replace("Bearer ", "");

  if (CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const result = await cleanupStaleDemoSessions();

    return NextResponse.json({
      success: true,
      message: "Demo cleanup completed",
      ...result,
    });
  } catch (error) {
    console.error("[Demo Cleanup Cron] Error:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing (protected by same secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
