import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This invitation endpoint is retired. Use the platform school admin invite flow.",
    },
    { status: 410 }
  );
}
