import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import type { AuditRequestContext } from "./types";

function firstIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Prefer client-provided idempotency headers; otherwise use a deterministic fallback
 * (Tier 0 replay safety — EDUSENTRIX_AUDIT_HARDENING_SPEC §4.11).
 */
export function resolveAuditIdempotencyKey(
  req: NextRequest,
  fallback: string
): string {
  return (
    req.headers.get("x-idempotency-key")?.trim() ||
    req.headers.get("idempotency-key")?.trim() ||
    fallback
  );
}

function baseRequestIds(req: NextRequest): { requestId: string; correlationId: string } {
  const requestId =
    req.headers.get("x-request-id")?.trim() ||
    req.headers.get("x-vercel-id")?.trim() ||
    randomUUID();
  const correlationId =
    req.headers.get("x-correlation-id")?.trim() || requestId;
  return { requestId, correlationId };
}

/** Map finance membership roles to an audit actor label. */
export function resolveFinanceActorRole(roles: string[]): string {
  if (roles.includes("bursar")) return "bursar";
  if (roles.includes("billing_owner")) return "billing_owner";
  return "school_admin";
}

/** Shared by admin fee routes and payment-setup when the actor is finance staff. */
export function buildFinanceStaffAuditContext(
  req: NextRequest,
  params: {
    userId: Types.ObjectId;
    schoolId: Types.ObjectId;
    roles: string[];
    actorEmail?: string | null;
    actorName?: string | null;
    idempotencyKey: string;
  }
): AuditRequestContext {
  return buildSchoolUserAuditContext(req, {
    userId: params.userId,
    schoolId: params.schoolId,
    actorRole: resolveFinanceActorRole(params.roles),
    actorEmail: params.actorEmail ?? null,
    actorName: params.actorName ?? null,
    idempotencyKey: params.idempotencyKey,
  });
}

/** Paystack (or similar) webhook — no human actor. */
export function buildPaystackWebhookAuditContext(
  req: NextRequest,
  params: {
    schoolId: Types.ObjectId;
    idempotencyKey: string;
  }
): AuditRequestContext {
  const { requestId, correlationId } = baseRequestIds(req);
  return {
    requestId,
    correlationId,
    idempotencyKey: params.idempotencyKey,
    actorType: "webhook",
    actorId: null,
    actorRole: null,
    actorEmail: null,
    actorName: "paystack",
    schoolId: params.schoolId,
    ipAddress: firstIp(req),
    userAgent: req.headers.get("user-agent")?.trim() || null,
    routePath: req.nextUrl.pathname,
    clientSurface: "webhook",
  };
}

/** Platform-scoped routes (e.g. school applications). */
export function buildPlatformAdminAuditContext(
  req: NextRequest,
  params: {
    platformAdminId: Types.ObjectId;
    actorEmail?: string | null;
    actorName?: string | null;
    idempotencyKey: string;
  }
): AuditRequestContext {
  const { requestId, correlationId } = baseRequestIds(req);
  return {
    requestId,
    correlationId,
    idempotencyKey: params.idempotencyKey,
    actorType: "user",
    actorId: params.platformAdminId,
    actorRole: "platform_admin",
    actorEmail: params.actorEmail ?? null,
    actorName: params.actorName ?? null,
    schoolId: null,
    ipAddress: firstIp(req),
    userAgent: req.headers.get("user-agent")?.trim() || null,
    routePath: req.nextUrl.pathname,
    clientSurface: "api",
  };
}

/** Platform admin acting on a specific school record (e.g. payout proposal). */
export function buildPlatformSchoolAuditContext(
  req: NextRequest,
  params: {
    platformAdminId: Types.ObjectId;
    schoolId: Types.ObjectId;
    actorEmail?: string | null;
    actorName?: string | null;
    idempotencyKey: string;
  }
): AuditRequestContext {
  return {
    ...buildPlatformAdminAuditContext(req, {
      platformAdminId: params.platformAdminId,
      actorEmail: params.actorEmail,
      actorName: params.actorName,
      idempotencyKey: params.idempotencyKey,
    }),
    schoolId: params.schoolId,
  };
}

/** School-scoped routes (finance, academics, etc.). */
export function buildSchoolUserAuditContext(
  req: NextRequest,
  params: {
    userId: Types.ObjectId;
    schoolId: Types.ObjectId;
    actorRole: string;
    actorEmail?: string | null;
    actorName?: string | null;
    idempotencyKey: string;
  }
): AuditRequestContext {
  const { requestId, correlationId } = baseRequestIds(req);
  return {
    requestId,
    correlationId,
    idempotencyKey: params.idempotencyKey,
    actorType: "user",
    actorId: params.userId,
    actorRole: params.actorRole,
    actorEmail: params.actorEmail ?? null,
    actorName: params.actorName ?? null,
    schoolId: params.schoolId,
    ipAddress: firstIp(req),
    userAgent: req.headers.get("user-agent")?.trim() || null,
    routePath: req.nextUrl.pathname,
    clientSurface: "api",
  };
}

/** Parent / guardian portal routes scoped to a school. */
export function buildParentAuditContext(
  req: NextRequest,
  params: {
    userId: Types.ObjectId;
    schoolId: Types.ObjectId;
    idempotencyKey: string;
  }
): AuditRequestContext {
  return buildSchoolUserAuditContext(req, {
    userId: params.userId,
    schoolId: params.schoolId,
    actorRole: "parent",
    idempotencyKey: params.idempotencyKey,
  });
}

/** Public unauthenticated POST (e.g. submit school application). */
export function buildPublicApplicationFormAuditContext(
  req: NextRequest,
  params: { idempotencyKey: string; submitterEmail?: string | null }
): AuditRequestContext {
  const { requestId, correlationId } = baseRequestIds(req);
  return {
    requestId,
    correlationId,
    idempotencyKey: params.idempotencyKey,
    actorType: "system",
    actorId: null,
    actorRole: "public_submitter",
    actorEmail: params.submitterEmail ?? null,
    actorName: null,
    schoolId: null,
    ipAddress: firstIp(req),
    userAgent: req.headers.get("user-agent")?.trim() || null,
    routePath: req.nextUrl.pathname,
    clientSurface: "public_form",
  };
}
