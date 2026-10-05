import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Retired. Paystack subaccount provisioning now uses BackgroundJob SCHOOL_PROVISIONING + Inngest.
 */
export async function GET() {
  return NextResponse.json(
    { success: false, error: "School payment provisioning now uses Inngest" },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "School payment provisioning now uses Inngest" },
    { status: 410 }
  );
}
