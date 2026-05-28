import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { applyDuePendingPlanChanges } from "@/lib/subscriptions/apply-plan-change";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.SUBSCRIPTION_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = req.nextUrl.searchParams.get("schoolId");
  if (schoolId && !mongoose.Types.ObjectId.isValid(schoolId)) {
    return NextResponse.json({ success: false, error: "Invalid schoolId." }, { status: 400 });
  }

  await connectToDatabase();

  const data = await applyDuePendingPlanChanges({
    schoolId: schoolId ?? undefined,
    dryRun: req.nextUrl.searchParams.get("dryRun") === "1",
    actorEmail: "system",
  });

  return NextResponse.json({ success: true, data });
}

export const GET = POST;
