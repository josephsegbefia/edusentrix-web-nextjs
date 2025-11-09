import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";

type Ok<T> = { success: true; data: T };
type Fail = { success: false; error: string };

function daysAgoToDate(key?: string | null) {
  const now = new Date();
  const map: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const d = map[key ?? ""] ?? 30;
  const from = new Date(now);
  from.setDate(now.getDate() - d);
  return from;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = url.searchParams.get("range");

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

  const from = daysAgoToDate(range);
  const [pending, approved, rejected] = await Promise.all([
    Application.countDocuments({
      createdAt: { $gte: from },
      status: { $in: ["submitted", "reviewed"] },
    }),
    Application.countDocuments({
      createdAt: { $gte: from },
      status: "approved",
    }),
    Application.countDocuments({
      createdAt: { $gte: from },
      status: "rejected",
    }),
  ]);

  return NextResponse.json<
    Ok<{ pending: number; approved: number; rejected: number }>
  >({
    success: true,
    data: { pending, approved, rejected },
  });
}
