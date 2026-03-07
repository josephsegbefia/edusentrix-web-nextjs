import { NextRequest, NextResponse } from "next/server";
import { runPilotCloseoutJob } from "@/lib/jobs/pilotCloseout";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.PLATFORM_BILLING_CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") || "";
  const xSecret = req.headers.get("x-cron-secret") || "";
  return bearer === `Bearer ${secret}` || xSecret === secret;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const run = await runPilotCloseoutJob({
      periodStart: req.nextUrl.searchParams.get("periodStart"),
      periodEnd: req.nextUrl.searchParams.get("periodEnd"),
      actorEmail: "system:pilot-closeout",
    });

    return NextResponse.json({
      ok: true,
      id: String(run._id),
      approvalStatus: run.approvalStatus,
      schoolCount: run.schoolCount,
      periodStart: run.periodStart.toISOString().slice(0, 10),
      periodEnd: run.periodEnd.toISOString().slice(0, 10),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid pilot closeout period.") {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Pilot closeout job failed.",
      },
      { status: 500 }
    );
  }
}
