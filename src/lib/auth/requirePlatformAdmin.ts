import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

export async function requirePlatformAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  await connectToDatabase();
  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("_id role email")
    .lean();

  // Normalize to ensure it's a single document, not an array
  const me = Array.isArray(meRaw) ? meRaw[0] : meRaw;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meTyped = me as any;
  if (!me || meTyped.role !== "platform_admin") {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, me };
}
