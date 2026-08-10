import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  connectToDemoDataDatabase,
  getDemoDataDatabaseConfig,
} from "@/db/connectToDemoDataDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { DemoLead } from "@/models/DemoLead";
import { DemoSession } from "@/models/DemoSession";
import { DemoEvent } from "@/models/DemoEvent";

type RawDoc = Record<string, any>;

function toIso(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function serializeLead(lead: RawDoc) {
  return {
    id: String(lead._id),
    fullName: lead.fullName || "",
    email: lead.email || "",
    phone: lead.phone || "",
    schoolName: lead.schoolName || "",
    schoolAddress: lead.schoolAddress || "",
    city: lead.city || "",
    region: lead.region || "",
    source: lead.source || "",
    status: lead.status || "new",
    notes: lead.notes || "",
    firstSeenAt: toIso(lead.firstSeenAt),
    lastSeenAt: toIso(lead.lastSeenAt),
    createdAt: toIso(lead.createdAt),
    updatedAt: toIso(lead.updatedAt),
  };
}

function serializeSession(session: RawDoc) {
  return {
    id: String(session._id),
    leadId: session.leadId ? String(session.leadId) : null,
    sandboxId: session.sandboxId ? String(session.sandboxId) : null,
    sandboxSchoolId: session.sandboxSchoolId ? String(session.sandboxSchoolId) : null,
    status: session.status || "",
    activePersonaRole: session.activePersonaRole || "",
    startedAt: toIso(session.startedAt),
    expiresAt: toIso(session.expiresAt),
    lastActiveAt: toIso(session.lastActiveAt),
    lastInteractionAt: toIso(session.lastInteractionAt),
    endedAt: toIso(session.endedAt),
    ipAddress: session.ipAddress || "",
    userAgent: session.userAgent || "",
  };
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

function formatPath(value: unknown) {
  return typeof value === "string" && value ? value : "Unknown page";
}

function eventTime(event: RawDoc) {
  const time = new Date(event.createdAt as Date | string).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildPageVisits(events: RawDoc[]) {
  const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));
  const rows = new Map<
    string,
    { path: string; title: string; views: number; clicks: number; durationMs: number; lastSeenAt: string | null }
  >();

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    const code = event.eventCode || "";
    const metadata = event.metadata || {};
    const path = formatPath(metadata.path);
    const title = typeof metadata.title === "string" ? metadata.title : "";
    const current =
      rows.get(path) ||
      { path, title, views: 0, clicks: 0, durationMs: 0, lastSeenAt: null };

    if (code === "page.viewed") {
      current.views += 1;
      const next = sorted[index + 1];
      const delta = next ? eventTime(next) - eventTime(event) : 0;
      if (delta > 0) current.durationMs += Math.min(delta, 5 * 60_000);
    }
    if (code === "page.dwell") {
      const durationMs = Number(metadata.durationMs || 0);
      if (Number.isFinite(durationMs) && durationMs > 0) {
        current.durationMs += Math.min(durationMs, 10 * 60_000);
      }
    }
    if (code === "ui.clicked" || code === "cta.clicked") {
      current.clicks += 1;
    }
    current.lastSeenAt = toIso(event.createdAt);
    rows.set(path, current);
  }

  return [...rows.values()].sort((a, b) => b.durationMs - a.durationMs || b.views - a.views);
}

function buildInterest(events: RawDoc[], sessions: RawDoc[]) {
  const pageViews = events.filter((event) => event.eventCode === "page.viewed").length;
  const clicks = events.filter((event) => event.eventCode === "ui.clicked" || event.eventCode === "cta.clicked").length;
  const personaSwitches = events.filter((event) => event.eventCode === "persona.switched").length;
  const exploredFeatures = events.filter((event) => event.eventCode === "feature.explored").length;
  const endedSessions = sessions.filter((session) => session.status === "ended").length;
  const activeSessions = sessions.filter((session) => session.status === "active").length;
  const pageVisits = buildPageVisits(events);
  const totalDurationMs = pageVisits.reduce((sum, page) => sum + page.durationMs, 0);
  const uniquePages = new Set(pageVisits.map((page) => page.path)).size;

  const score = Math.min(
    100,
    Math.round(
      Math.min(sessions.length * 10, 20) +
        Math.min(pageViews * 2, 20) +
        Math.min(uniquePages * 4, 20) +
        Math.min(clicks * 5, 20) +
        Math.min(personaSwitches * 5, 15) +
        Math.min(exploredFeatures * 5, 15) +
        Math.min(totalDurationMs / 60_000 * 4, 20) +
        endedSessions * 8 +
        activeSessions * 4
    )
  );

  const classification =
    score >= 70 ? "high_intent" : score >= 45 ? "warm" : score >= 20 ? "exploratory" : "cold";

  const recommendations = [
    score >= 70
      ? "Call within 24 hours and reference the specific pages they explored most."
      : null,
    score >= 45 && score < 70
      ? "Send a short follow-up with a focused demo offer and one relevant case angle."
      : null,
    clicks === 0
      ? "Clicks are low or not yet captured for this session; ask what they wanted to test next."
      : null,
    personaSwitches > 0
      ? "They switched roles, so position EduSentrix as a full-school operating system, not a single-user tool."
      : null,
    pageViews <= 2
      ? "Engagement is shallow; use a light nurture follow-up instead of a hard sales push."
      : null,
  ].filter(Boolean);

  return {
    score,
    classification,
    signals: {
      sessions: sessions.length,
      pageViews,
      uniquePages,
      clicks,
      personaSwitches,
      exploredFeatures,
      totalDurationMs: Math.round(totalDurationMs),
    },
    recommendations,
  };
}

async function loadFromExternalDb(leadId: string) {
  const demoDb = await connectToDemoDataDatabase();
  if (!demoDb) return null;
  const objectId = new ObjectId(leadId);
  const [lead, sessions, events] = await Promise.all([
    demoDb.collection("demoleads").findOne({ _id: objectId }),
    demoDb.collection("demosessions").find({ leadId: objectId }).sort({ startedAt: -1 }).toArray(),
    demoDb.collection("demoevents").find({ leadId: objectId }).sort({ createdAt: -1 }).limit(500).toArray(),
  ]);
  return { demoDb, lead, sessions, events };
}

async function loadFromPlatformDb(leadId: string) {
  await connectToDatabase();
  const [lead, sessions, events] = await Promise.all([
    DemoLead.findById(leadId).lean(),
    DemoSession.find({ leadId }).sort({ startedAt: -1 }).lean(),
    DemoEvent.find({ leadId }).sort({ createdAt: -1 }).limit(500).lean(),
  ]);
  return { lead, sessions, events };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.res;

  const { leadId } = await params;
  if (!ObjectId.isValid(leadId)) {
    return NextResponse.json({ success: false, error: "Invalid demo lead id." }, { status: 400 });
  }

  const demoDataConfig = getDemoDataDatabaseConfig();
  const external = await loadFromExternalDb(leadId).catch(() => null);
  const source = external || (await loadFromPlatformDb(leadId));

  if (!source.lead) {
    return NextResponse.json({ success: false, error: "Demo lead not found." }, { status: 404 });
  }

  const events = source.events as RawDoc[];
  const sessions = source.sessions as RawDoc[];
  const pageVisits = buildPageVisits(events);

  return NextResponse.json({
    success: true,
    data: {
      lead: serializeLead(source.lead as RawDoc),
      sessions: sessions.map(serializeSession),
      events: events.map(serializeEvent),
      pageVisits,
      interest: buildInterest(events, sessions),
      dataSource: external ? "external_demo_database" : "platform_database",
      dataSourceInfo: {
        databaseName: external?.demoDb.databaseName || DemoLead.db.db?.databaseName || null,
        configuredDatabaseName: demoDataConfig.databaseName || null,
        databaseNameSource: demoDataConfig.databaseNameSource,
      },
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.res;

  const { leadId } = await params;
  if (!ObjectId.isValid(leadId)) {
    return NextResponse.json({ success: false, error: "Invalid demo lead id." }, { status: 400 });
  }

  const external = await loadFromExternalDb(leadId).catch(() => null);
  if (external?.lead) {
    const objectId = new ObjectId(leadId);
    const [events, sessions, lead] = await Promise.all([
      external.demoDb.collection("demoevents").deleteMany({ leadId: objectId }),
      external.demoDb.collection("demosessions").deleteMany({ leadId: objectId }),
      external.demoDb.collection("demoleads").deleteOne({ _id: objectId }),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        deletedLeadCount: lead.deletedCount,
        deletedSessionCount: sessions.deletedCount,
        deletedEventCount: events.deletedCount,
      },
    });
  }

  await connectToDatabase();
  const objectId = new ObjectId(leadId);
  const [events, sessions, lead] = await Promise.all([
    DemoEvent.deleteMany({ leadId: objectId }),
    DemoSession.deleteMany({ leadId: objectId }),
    DemoLead.deleteOne({ _id: objectId }),
  ]);

  if (!lead.deletedCount) {
    return NextResponse.json({ success: false, error: "Demo lead not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      deletedLeadCount: lead.deletedCount,
      deletedSessionCount: sessions.deletedCount,
      deletedEventCount: events.deletedCount,
    },
  });
}
