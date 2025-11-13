/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({} as { email: string }));
  if (!email) {
    return NextResponse.json(
      { exists: false, error: "Email is required" },
      { status: 400 }
    );
  }

  await connectToDatabase();
  const doc = await User.findOne({ email: String(email).toLowerCase() })
    .select("_id role  pendingOnboarding")
    .lean();

  return NextResponse.json(
    {
      exists: !!doc,
      role: doc ? (doc as any).role : null,
      pendingOnboarding: doc ? (doc as any).pendingOnboarding : null,
    },
    { status: 200 }
  );
}
