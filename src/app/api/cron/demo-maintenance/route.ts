import { NextRequest, NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/runtime";
import { processResetQueue, expireStaleSessions } from "@/lib/demo/reset-worker";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  const expired = await expireStaleSessions();
  const resetResult = await processResetQueue();

  return NextResponse.json({
    success: true,
    data: {
      expiredSessions: expired,
      resetQueue: resetResult,
    },
  });
}
