import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/db/connectToDatabase";
import { connectToDemoDataDatabase } from "@/db/connectToDemoDataDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import { DemoSandbox } from "@/models/DemoSandbox";
import { DemoEvent } from "@/models/DemoEvent";

type RawDoc = Record<string, any>;

function toIso(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeEvent(event: RawDoc) {
  return {
    id: String(event._id),
    leadId: event.leadId ? String(event.leadId) : null,
    sessionId: event.sessionId ? String(event.sessionId) : null,
    sandboxId: event.sandboxId ? String(event.sandboxId) : null,
    schoolId: event.schoolId ? String(event.schoolId) : null,
    actorRole: event.actorRole || "",
    actorUserId: event.actorUserId ? String(event.actorUserId) : null,
    eventType: event.eventType || "",
    eventCode: event.eventCode || "",
    metadata: event.metadata || null,
    createdAt: toIso(event.createdAt),
  };
}

function mapCountRows(rows: Array<{ _id: string | null; count: number }>) {
  return Object.fromEntries(
    rows.map((row) => [row._id || "unknown", row.count || 0])
  );
}

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.res;

  await connectToDatabase();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const skip = (page - 1) * limit;
  const status = url.searchParams.get("status") || undefined;
  const leadId = url.searchParams.get("leadId") || undefined;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const hasExternalDemoDataConfig = Boolean(
    process.env.DEMO_DATA_MONGODB_URI || process.env.DEMO_MONGODB_URI
  );
  let demoDb = null;
  let demoDataError: string | null = null;
  try {
    demoDb = await connectToDemoDataDatabase();
  } catch (error) {
    demoDataError =
      error instanceof Error ? error.message : "Could not connect to the demo data database.";
  }

  let leads: Array<Record<string, unknown>>;
  let total: number;
  let activeSessions: number;
  let sandboxStats: Array<{ _id: string; count: number }>;
  let leadStatusStats: Array<{ _id: string; count: number }>;
  let sessionStatusStats: Array<{ _id: string; count: number }>;
  let eventCodeStats: Array<{ _id: string; count: number }>;
  let recentEvents: Array<Record<string, unknown>>;

  if (demoDb) {
    const [rawLeads, rawTotal, rawActiveSessions, rawSandboxStats, rawLeadStatusStats, rawSessionStatusStats, rawEventCodeStats, rawRecentEvents] =
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
            firstSessionId: 1,
            lastSessionId: 1,
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
        demoDb
          .collection("demoleads")
          .aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
          .toArray(),
        demoDb
          .collection("demosessions")
          .aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
          .toArray(),
        demoDb
          .collection("demoevents")
          .aggregate<{ _id: string; count: number }>([
            { $group: { _id: "$eventCode", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 12 },
          ])
          .toArray(),
        demoDb
          .collection("demoevents")
          .find({})
          .sort({ createdAt: -1 })
          .limit(30)
          .toArray(),
      ]);

    const leadObjectIds = rawLeads
      .map((lead) => lead._id)
      .filter((id): id is ObjectId => id instanceof ObjectId);
    const [sessionRows, eventRows] = await Promise.all([
      leadObjectIds.length
        ? demoDb
            .collection("demosessions")
            .aggregate<{
              _id: ObjectId;
              sessionCount: number;
              lastSessionAt: Date | null;
              lastSessionStatus: string | null;
            }>([
              { $match: { leadId: { $in: leadObjectIds } } },
              { $sort: { lastActiveAt: -1, createdAt: -1 } },
              {
                $group: {
                  _id: "$leadId",
                  sessionCount: { $sum: 1 },
                  lastSessionAt: { $max: "$lastActiveAt" },
                  lastSessionStatus: { $first: "$status" },
                },
              },
            ])
            .toArray()
        : [],
      leadObjectIds.length
        ? demoDb
            .collection("demoevents")
            .aggregate<{
              _id: ObjectId;
              eventCount: number;
              lastEventAt: Date | null;
            }>([
              { $match: { leadId: { $in: leadObjectIds } } },
              {
                $group: {
                  _id: "$leadId",
                  eventCount: { $sum: 1 },
                  lastEventAt: { $max: "$createdAt" },
                },
              },
            ])
            .toArray()
        : [],
    ]);
    const sessionsByLead = new Map(sessionRows.map((row) => [String(row._id), row]));
    const eventsByLead = new Map(eventRows.map((row) => [String(row._id), row]));

    leads = rawLeads.map((lead) => ({
      _id: String(lead._id),
      fullName: lead.fullName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      schoolName: lead.schoolName || "",
      status: lead.status || "new",
      firstSeenAt: toIso(lead.firstSeenAt),
      lastSeenAt: toIso(lead.lastSeenAt),
      firstSessionId: lead.firstSessionId ? String(lead.firstSessionId) : null,
      lastSessionId: lead.lastSessionId ? String(lead.lastSessionId) : null,
      sessionCount: sessionsByLead.get(String(lead._id))?.sessionCount || 0,
      lastSessionStatus: sessionsByLead.get(String(lead._id))?.lastSessionStatus || null,
      lastSessionAt: toIso(sessionsByLead.get(String(lead._id))?.lastSessionAt),
      eventCount: eventsByLead.get(String(lead._id))?.eventCount || 0,
      lastEventAt: toIso(eventsByLead.get(String(lead._id))?.lastEventAt),
    }));
    total = rawTotal;
    activeSessions = rawActiveSessions;
    sandboxStats = rawSandboxStats;
    leadStatusStats = rawLeadStatusStats;
    sessionStatusStats = rawSessionStatusStats;
    eventCodeStats = rawEventCodeStats;
    recentEvents = rawRecentEvents.map(serializeEvent);
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
      DemoLead.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DemoSession.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DemoEvent.aggregate([
        { $group: { _id: "$eventCode", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      DemoEvent.find({}).sort({ createdAt: -1 }).limit(30).lean(),
    ]);

    const [rawLeads, rawTotal, rawActiveSessions, rawSandboxStats, rawLeadStatusStats, rawSessionStatusStats, rawEventCodeStats, rawRecentEvents] = results;
    const leadIds = rawLeads.map((lead) => lead._id);
    const [sessionRows, eventRows] = await Promise.all([
      leadIds.length
        ? DemoSession.aggregate([
            { $match: { leadId: { $in: leadIds } } },
            { $sort: { lastActiveAt: -1, createdAt: -1 } },
            {
              $group: {
                _id: "$leadId",
                sessionCount: { $sum: 1 },
                lastSessionAt: { $max: "$lastActiveAt" },
                lastSessionStatus: { $first: "$status" },
              },
            },
          ])
        : [],
      leadIds.length
        ? DemoEvent.aggregate([
            { $match: { leadId: { $in: leadIds } } },
            {
              $group: {
                _id: "$leadId",
                eventCount: { $sum: 1 },
                lastEventAt: { $max: "$createdAt" },
              },
            },
          ])
        : [],
    ]);

    const sessionsByLead = new Map(sessionRows.map((row) => [String(row._id), row]));
    const eventsByLead = new Map(eventRows.map((row) => [String(row._id), row]));
    leads = rawLeads.map((lead) => ({
      _id: String(lead._id),
      fullName: lead.fullName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      schoolName: lead.schoolName || "",
      status: lead.status || "new",
      firstSeenAt: toIso(lead.firstSeenAt),
      lastSeenAt: toIso(lead.lastSeenAt),
      firstSessionId: lead.firstSessionId ? String(lead.firstSessionId) : null,
      lastSessionId: lead.lastSessionId ? String(lead.lastSessionId) : null,
      sessionCount: sessionsByLead.get(String(lead._id))?.sessionCount || 0,
      lastSessionStatus: sessionsByLead.get(String(lead._id))?.lastSessionStatus || null,
      lastSessionAt: toIso(sessionsByLead.get(String(lead._id))?.lastSessionAt),
      eventCount: eventsByLead.get(String(lead._id))?.eventCount || 0,
      lastEventAt: toIso(eventsByLead.get(String(lead._id))?.lastEventAt),
    }));
    total = rawTotal;
    activeSessions = rawActiveSessions;
    sandboxStats = rawSandboxStats as Array<{ _id: string; count: number }>;
    leadStatusStats = rawLeadStatusStats as Array<{ _id: string; count: number }>;
    sessionStatusStats = rawSessionStatusStats as Array<{ _id: string; count: number }>;
    eventCodeStats = rawEventCodeStats as Array<{ _id: string; count: number }>;
    recentEvents = (rawRecentEvents as RawDoc[]).map(serializeEvent);
  }

  const sandboxSummary = Object.fromEntries(
    sandboxStats.map((s: { _id: string; count: number }) => [s._id, s.count])
  );
  let selectedLeadEvents: Array<Record<string, unknown>> = [];
  if (leadId) {
    if (demoDb && ObjectId.isValid(leadId)) {
      selectedLeadEvents = (
        await demoDb
          .collection("demoevents")
          .find({ leadId: new ObjectId(leadId) })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray()
      ).map(serializeEvent);
    } else {
      selectedLeadEvents = (
        await DemoEvent.find({ leadId })
          .sort({ createdAt: -1 })
          .limit(100)
          .lean()
      ).map(serializeEvent);
    }
  }
  const warnings = [
    !hasExternalDemoDataConfig
      ? "No DEMO_DATA_MONGODB_URI or DEMO_MONGODB_URI is configured, so this page is reading the platform database instead of a separate demo database."
      : null,
    demoDataError ? `Could not read external demo database: ${demoDataError}` : null,
  ].filter(Boolean);

  return NextResponse.json({
    success: true,
    data: {
      leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        activeSessions,
        sandboxPool: sandboxSummary,
        leadsByStatus: mapCountRows(leadStatusStats),
        sessionsByStatus: mapCountRows(sessionStatusStats),
        eventsByCode: mapCountRows(eventCodeStats),
      },
      recentEvents,
      selectedLeadEvents,
      dataSource: demoDb ? "external_demo_database" : "platform_database",
      warnings,
    },
  });
}
