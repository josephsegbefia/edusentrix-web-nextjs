import { NextRequest, NextResponse } from "next/server";

// Simple health check endpoint for network connectivity monitoring
// HEAD requests are used by NetworkHealthWatcher to probe connectivity
export async function HEAD(_req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

// Also support GET requests for manual health checks
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
