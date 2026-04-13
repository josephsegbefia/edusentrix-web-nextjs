import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { AuditEvent } from "@/models/AuditEvent";
import type { IAuditDomain } from "@/models/AuditEvent";

const DOMAINS = new Set<IAuditDomain>([
  "identity",
  "academics",
  "finance",
  "billing",
  "communication",
  "applications",
  "timetable",
  "system",
  "email",
]);

/**
 * GET /api/platform/audit — normalized audit trail (platform admins).
 */
export async function GET(req: NextRequest) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 50), 1),
    200
  );
  const cursor = url.searchParams.get("cursor");
  const domain = url.searchParams.get("domain");
  const actionCode = url.searchParams.get("actionCode");

  const filter: Record<string, unknown> = {};
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }
  if (domain && DOMAINS.has(domain as IAuditDomain)) {
    filter.domain = domain as IAuditDomain;
  }
  if (actionCode?.trim()) {
    filter.actionCode = actionCode.trim();
  }

  const docs = await AuditEvent.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;

  const items = slice.map((d) => ({
    id: String(d._id),
    scopeType: d.scopeType,
    scopeId: d.scopeId ? String(d.scopeId) : null,
    domain: d.domain,
    tier: d.tier,
    actionCode: d.actionCode,
    result: d.result,
    occurredAt: d.occurredAt.toISOString(),
    recordedAt: d.recordedAt.toISOString(),
    actorType: d.actorType,
    actorRole: d.actorRole ?? null,
    actorEmail: d.actorEmail ?? null,
    targetEntityType: d.targetEntityType,
    targetEntityId: String(d.targetEntityId),
    streamKey: d.streamKey ?? null,
    routePath: d.routePath ?? null,
    metadata: d.metadata ?? null,
  }));

  return NextResponse.json({
    success: true,
    data: { items, nextCursor },
  });
}
