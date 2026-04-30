// POST/GET — notify patrons about loans due within each school's `dueReminderDaysBefore` window.
//
// Auth: `LIBRARY_CRON_SECRET` or fallback `CRON_SECRET`, via
// `Authorization: Bearer <secret>` or `x-cron-secret: <secret>`.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enqueueDueSoonLibraryLoanRemindersGlobally } from "@/lib/library/library-jobs";
import { isLibraryCronAuthorized } from "@/lib/library/library-reservation-scheduler";

export async function POST(req: NextRequest) {
  if (!isLibraryCronAuthorized(req)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const data = await enqueueDueSoonLibraryLoanRemindersGlobally();
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("library-loans-due-soon cron:", e);
    return NextResponse.json(
      { success: false, error: "Failed due-soon library reminders" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
