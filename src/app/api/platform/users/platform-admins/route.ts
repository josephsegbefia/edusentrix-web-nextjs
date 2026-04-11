import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { User } from "@/models/User";

export const runtime = "nodejs";

/**
 * Minimal list for pipeline owner assignment (platform admin only).
 */
export async function GET() {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  await connectToDatabase();

  const rows = await User.find({ role: "platform_admin" })
    .select("firstName lastName email name")
    .sort({ email: 1 })
    .limit(100)
    .lean();

  const data = rows.map((u) => ({
    _id: String(u._id),
    name:
      u.name ||
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
      u.email,
    email: u.email,
  }));

  return NextResponse.json({ success: true, data });
}
