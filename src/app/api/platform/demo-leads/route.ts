import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { connectToDemoDataDatabase } from "@/db/connectToDemoDataDatabase";
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

  const demoDb = await connectToDemoDataDatabase();

  let leads:
    | Array<{
        _id: string;
        fullName: string;
        email: string;
        phone: string;
        schoolName: string;
        status: string;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
      }>
    | Array<Record<string, unknown>>;
  let total: number;
  let activeSessions: number;
  let sandboxStats: Array<{ _id: string; count: number }>;

  if (demoDb) {
    const [rawLeads, rawTotal, rawActiveSessions, rawSandboxStats] =
      await Promise.all([
        demoDb
          .collection("demoleads")
          .find(filter)
          .sort({ lastSeenAt: -1 })
          .skip(skip)
          .limit(limit)
          .project({
            fullName: 1,
            email: 1,
            phone: 1,
            schoolName: 1,
            status: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
          })
          .toArray(),
        demoDb.collection("demoleads").countDocuments(filter),
        demoDb.collection("demosessions").countDocuments({ status: "active" }),
        demoDb
          .collection("demosandboxes")
          .aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$state", count: { $sum: 1 } } },
          ])
          .toArray(),
      ]);

    leads = rawLeads.map((lead) => ({
      _id: String(lead._id),
      fullName: lead.fullName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      schoolName: lead.schoolName || "",
      status: lead.status || "new",
      firstSeenAt: lead.firstSeenAt ?? null,
      lastSeenAt: lead.lastSeenAt ?? null,
    }));
    total = rawTotal;
    activeSessions = rawActiveSessions;
    sandboxStats = rawSandboxStats;
  } else {
    const results = await Promise.all([
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

    [leads, total, activeSessions, sandboxStats] = results;
  }

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
