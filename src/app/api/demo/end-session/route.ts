import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import {
  resolveDemoSessionFromCookie,
  clearDemoSessionCookie,
} from "@/lib/demo/session";
import { DemoSession } from "@/models/DemoSession";
import { DemoLead } from "@/models/DemoLead";
import { releaseDemoSandbox } from "@/lib/demo/sandbox";

export async function POST() {
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

  await DemoSession.updateOne(
    { _id: session._id },
    { $set: { status: "ended", endedAt: now } }
  );

  if (session.sandboxId) {
    await releaseDemoSandbox(session.sandboxId);
  }

  await DemoLead.updateOne(
    { _id: session.leadId },
    { $set: { status: "completed_demo", lastSeenAt: now } }
  );

  await clearDemoSessionCookie();

  return NextResponse.json({ success: true });
}
