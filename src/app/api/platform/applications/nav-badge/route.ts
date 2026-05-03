import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; error: string };

/**
 * Count of school signup applications still awaiting approve/reject
 * (same notion of "pending" as /api/platform/applications?status=pending — submitted or reviewed).
 */
export async function GET() {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;

  await connectToDatabase();
  const me = guard.me;
  if (!me || me.role !== "platform_admin") {
    return NextResponse.json<Fail>(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  const pendingCount = await Application.countDocuments({
    status: { $in: ["submitted", "reviewed"] },
  });

  return NextResponse.json<Ok<{ pendingCount: number }>>({
    success: true,
    data: { pendingCount },
  });
}
