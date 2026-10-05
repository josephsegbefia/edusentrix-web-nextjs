import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired. Communication outbox now uses BackgroundJob COMMUNICATION_OUTBOX + Inngest.
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: "Communication outbox now uses Inngest" },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Communication outbox now uses Inngest" },
    { status: 410 }
  );
}
