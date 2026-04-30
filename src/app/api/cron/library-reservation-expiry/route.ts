// POST/GET — expire stale library holds (pending/ready past expiresAt or legacy age).
//
// Auth: `LIBRARY_CRON_SECRET` or fallback `CRON_SECRET`, via
// `Authorization: Bearer <secret>` or `x-cron-secret: <secret>`.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  expireStaleLibraryReservationsGlobally,
  isLibraryCronAuthorized,
} from "@/lib/library/library-reservation-scheduler";

export async function POST(req: NextRequest) {
  if (!isLibraryCronAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const data = await expireStaleLibraryReservationsGlobally();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("library-reservation-expiry cron:", e);
    return NextResponse.json(
      { success: false, error: "Failed to expire library reservations" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
