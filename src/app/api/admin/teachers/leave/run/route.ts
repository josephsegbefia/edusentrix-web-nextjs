export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { runTeacherLeaveAutomation } from "@/lib/teachers/leaveAutomation";

function parseReminderOffsets(raw: string | null) {
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.floor(v));
  return values.length > 0 ? values : undefined;
}

/**
 * Internal leave automation runner.
 * Security: require x-internal-key to match INTERNAL_CRON_SECRET.
 *
 * Suggested cron cadence: daily (or every few hours).
 * Optional query: ?reminderDays=3,2,1
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-key");
  if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const url = new URL(req.url);
  const reminderOffsets = parseReminderOffsets(url.searchParams.get("reminderDays"));

  const result = await runTeacherLeaveAutomation({
    reminderOffsets,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
