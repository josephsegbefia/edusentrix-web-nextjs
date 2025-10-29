import { NextResponse } from "next/server";

// TODO: Replace with real Supabase+Mongo verification.
// For now, return null to indicate "not authenticated".
export async function GET() {
  // Example of a logged-in shape you’ll return later:
  return NextResponse.json({
    userId: "u_123",
    role: "schoolAdmin",
    schoolId: "s_001",
    schoolStatus: "active",
    tier: "Basic",
  });

  return NextResponse.json(null, { status: 200 });
}
