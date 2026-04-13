import { randomUUID } from "node:crypto";
import type { AuditActorType, AuditRequestContext } from "./types";
import type { Types } from "mongoose";

type HeaderLike = {
  get(name: string): string | null | undefined;
};

function firstForwardedFor(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

/**
 * Build normalized audit context from HTTP headers (Next.js Request, Web API Headers, etc.).
 * When no user exists (webhooks), pass actorType and optional actor ids explicitly.
 */
export function buildAuditRequestContextFromHeaders(
  headers: HeaderLike,
  params: {
    actorType: AuditActorType;
    actorId?: string | Types.ObjectId | null;
    actorRole?: string | null;
    actorEmail?: string | null;
    actorName?: string | null;
    schoolId?: string | Types.ObjectId | null;
    routePath?: string | null;
    clientSurface?: string | null;
    correlationId?: string | null;
    idempotencyKey?: string | null;
  }
): AuditRequestContext {
  const requestId =
    headers.get("x-request-id")?.trim() ||
    headers.get("x-vercel-id")?.trim() ||
    randomUUID();

  const correlationId =
    params.correlationId?.trim() ||
    headers.get("x-correlation-id")?.trim() ||
    requestId;

  const ipAddress =
    firstForwardedFor(headers.get("x-forwarded-for")) ||
    headers.get("x-real-ip")?.trim() ||
    null;

  const userAgent = headers.get("user-agent")?.trim() || null;

  return {
    requestId,
    correlationId,
    idempotencyKey: params.idempotencyKey?.trim() || undefined,
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    actorRole: params.actorRole ?? null,
    actorEmail: params.actorEmail ?? null,
    actorName: params.actorName ?? null,
    schoolId: params.schoolId ?? null,
    ipAddress,
    userAgent,
    routePath: params.routePath ?? null,
    clientSurface: params.clientSurface ?? null,
  };
}
