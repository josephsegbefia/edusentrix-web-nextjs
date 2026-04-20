import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { isDemoMode } from "@/lib/demo/runtime";
import {
  resolveDemoSessionFromCookie,
  touchDemoSessionInteraction,
} from "@/lib/demo/session";

export async function POST() {
  if (!isDemoMode()) {
    return NextResponse.json(
      { success: false, error: "Demo mode is not enabled." },
      { status: 404 }
    );
  }

  await connectToDatabase();

  const session = await resolveDemoSessionFromCookie({
    touch: true,
    enforceIdleTimeout: true,
  });
  if (!session) {
    return NextResponse.json(
      { success: false, error: "No active demo session." },
      { status: 401 }
    );
  }

  await touchDemoSessionInteraction(session._id);

  return NextResponse.json({ success: true });
}
