export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { claimOneJob, processJob } from "@/lib/jobs/provisioning";

/**
 * Internal runner endpoint.
 * Security: require X-INTERNAL-KEY to match env INTERNAL_CRON_SECRET.
 * Query: ?limit=5 (default)
 *
 * Suggested cron (every 5 mins or as you prefer).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-key");
  if (
    !process.env.INTERNAL_CRON_SECRET ||
    secret !== process.env.INTERNAL_CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(25, Number(url.searchParams.get("limit") || 5))
  );

  await connectToDatabase();

  const session = await mongoose.startSession();
  let processed = 0;
  const pickedIds: string[] = [];

  try {
    for (let i = 0; i < limit; i++) {
      // Claim one (single-doc atomic claim)
      const job = await claimOneJob(session);
      if (!job) break;

      pickedIds.push(String(job._id));
      await processJob(job);
      processed += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      pickedIds,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, processed, error: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
