import { NextRequest, NextResponse } from "next/server";
import { runImapRecoverySync } from "@/lib/jobs/imapRecoverySync";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.IMAP_RECOVERY_CRON_SECRET;
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

    const result = await runImapRecoverySync();

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "IMAP recovery sync failed.",
      },
      { status: 500 },
    );
  }
}
