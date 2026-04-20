import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import {
  resolveDemoSessionFromCookie,
  clearDemoSessionCookie,
  endDemoSession,
} from "@/lib/demo/session";

export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  await connectToDatabase();

  const session = await resolveDemoSessionFromCookie();
  if (!session) {
    await clearDemoSessionCookie();
    return NextResponse.json(
      { success: false, error: "No active demo session." },
      { status: 401 }
    );
  }

  const now = new Date();
  let reason: "manual_end" | "tab_closed" | "idle_timeout" = "manual_end";
  try {
    const body = await req.json();
    if (
      body?.reason === "tab_closed" ||
      body?.reason === "idle_timeout" ||
      body?.reason === "manual_end"
    ) {
      reason = body.reason;
    }
  } catch {
    // sendBeacon often sends an empty body — ignore parse errors.
  }
  await endDemoSession(session, reason, now);

  await clearDemoSessionCookie();

  return NextResponse.json({ success: true });
}
