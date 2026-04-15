import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import { DemoSandbox } from "@/models/DemoSandbox";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") || undefined;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [leads, total, activeSessions, sandboxStats] = await Promise.all([
    DemoLead.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DemoLead.countDocuments(filter),
    DemoSession.countDocuments({ status: "active" }),
    DemoSandbox.aggregate([
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]),
  ]);

  const sandboxSummary = Object.fromEntries(
    sandboxStats.map((s: { _id: string; count: number }) => [s._id, s.count])
  );

  return NextResponse.json({
    success: true,
    data: {
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        activeSessions,
        sandboxPool: sandboxSummary,
      },
    },
  });
}
