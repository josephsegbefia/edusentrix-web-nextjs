// src/app/api/cron/admissions-weekly-digest/route.ts
// Cron handler that ships the weekly admissions digest to admission managers.
//
// Auth: shared secret via `Authorization: Bearer ...` or `x-cron-secret`.
// Trigger: weekly via Vercel Cron / GitHub Actions / external scheduler.
// Optional query param `?schoolId=<id>` constrains the run to a single school
// (useful for support teams asking "send me a fresh digest").
// Optional query param `?dryRun=1` renders + reports without sending.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { sendWeeklyDigestForSchool } from "@/lib/admissions/weekly-digest";

function isAuthorized(req: NextRequest) {
  const secret = process.env.ADMISSIONS_DIGEST_CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const filterSchoolId = url.searchParams.get("schoolId");

  try {
    await connectToDatabase();

    let schoolIds: mongoose.Types.ObjectId[];
    if (filterSchoolId) {
      if (!mongoose.Types.ObjectId.isValid(filterSchoolId)) {
        return NextResponse.json(
          { success: false, error: "Invalid schoolId" },
          { status: 400 }
        );
      }
      schoolIds = [new mongoose.Types.ObjectId(filterSchoolId)];
    } else {
      const distinct = await AdmissionCycle.distinct("schoolId", {
        status: { $in: ["published", "paused"] },
      });
      schoolIds = (distinct as mongoose.Types.ObjectId[]) ?? [];
    }

    const results = [];
    for (const sid of schoolIds) {
      try {
        const r = await sendWeeklyDigestForSchool(sid, { dryRun });
        results.push(r);
      } catch (err) {
        console.error(
          "Weekly digest failed for school",
          String(sid),
          err instanceof Error ? err.message : err
        );
        results.push({
          schoolId: String(sid),
          schoolName: "(error)",
          cycleCount: 0,
          recipients: 0,
          sent: 0,
          skipped: 0,
          reason: err instanceof Error ? err.message : "send failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        dryRun,
        schoolCount: schoolIds.length,
        totalSent: results.reduce((s, r) => s + r.sent, 0),
        totalSkipped: results.reduce((s, r) => s + r.skipped, 0),
        results,
      },
    });
  } catch (error) {
    console.error("Admissions digest cron error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run digest" },
      { status: 500 }
    );
  }
}

// GET mirrors POST so simple uptime monitors / curl-based crons can trigger it.
export const GET = POST;
