import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired. Outbound email dispatch now uses BackgroundJob EMAIL_DISPATCH + Inngest.
 * Leftover schedulers fail closed.
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Email dispatch now uses Inngest" },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Email dispatch now uses Inngest" },
    { status: 410 }
  );
}
