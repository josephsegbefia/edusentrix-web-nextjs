/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { z } from "zod";
import { Types } from "mongoose";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import {
  buildPublicApplicationFormAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { GhanaRegionSchema } from "@/constants/ghanaRegions";
import {
  buildPipelineStageMongoFilter,
  PIPELINE_STAGE_LABELS,
  resolveEffectivePipelineStage,
} from "@/constants/application-pipeline";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/versions";

// Optional: ensure useful indexes in your model file (shown below).
// applicationSchema.index({ status: 1, createdAt: -1 });
// applicationSchema.index({ schoolType: 1 });
// applicationSchema.index({ adminEmail: 1 });
// applicationSchema.index({ schoolName: 1 });

type Ok<T> = { success: true; data: T };
type Fail = { success: false; error: string };

function daysAgoToDate(key?: string | null) {
  if (key === "all") return null;
  const now = new Date();
  const map: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const d = map[key ?? ""] ?? 30;
  const from = new Date(now);
  from.setDate(now.getDate() - d);
  return from;
}

// Map UI statuses to DB statuses
// UI: pending | approved | rejected
// DB: submitted | reviewed | approved | rejected
function buildStatusFilter(uiStatus?: string | null) {
  if (!uiStatus || uiStatus === "all") return undefined;
  if (uiStatus === "pending") return { $in: ["submitted", "reviewed"] };
  if (uiStatus === "approved") return "approved";
  if (uiStatus === "rejected") return "rejected";
  return undefined;
}

function buildArchiveFilter(visibility?: string | null) {
  if (visibility === "archived") return { $ne: null };
  if (visibility === "all") return undefined;
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending|approved|rejected|all
  const type = url.searchParams.get("type"); // Basic|Secondary|all
  const q = url.searchParams.get("q")?.trim();
  const range = url.searchParams.get("range"); // 7d|30d|90d
  const pipelineStage = url.searchParams.get("pipelineStage"); // pipeline stage filter
  const visibility = url.searchParams.get("visibility"); // active|archived|all
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const cursor = url.searchParams.get("cursor"); // last _id string

  // Auth + role enforcement (API side)
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

  const filter: Record<string, unknown> = {};
  const clauses: Record<string, unknown>[] = [];

  const statusFilter = buildStatusFilter(status);
  if (statusFilter) clauses.push({ status: statusFilter });
  const archiveFilter = buildArchiveFilter(visibility);
  if (archiveFilter !== undefined) clauses.push({ archivedAt: archiveFilter });
  if (type && type !== "all") clauses.push({ schoolType: type });

  const from = daysAgoToDate(range);
  if (from) clauses.push({ createdAt: { $gte: from } });

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    clauses.push({
      $or: [
        { schoolName: rx },
        { adminEmail: rx },
        { adminFirstName: rx },
        { adminLastName: rx },
        { city: rx },
        { region: rx },
      ],
    });
  }

  const pipelineFilter = buildPipelineStageMongoFilter(pipelineStage);
  if (pipelineFilter) clauses.push(pipelineFilter);

  if (clauses.length === 1) {
    Object.assign(filter, clauses[0]);
  } else {
    filter.$and = clauses;
  }

  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await Application.find(filter)
    .populate("ownerUserId", "firstName lastName email name")
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  // Shape to UI type and normalize status
  const dataOut = items.map((d) => {
    const effectiveStage = resolveEffectivePipelineStage({
      stage: d.stage,
      status: d.status,
    });
    const owner =
      d.ownerUserId && typeof d.ownerUserId === "object"
        ? {
            _id: String((d.ownerUserId as { _id: Types.ObjectId })._id),
            name:
              (d.ownerUserId as { name?: string }).name ||
              [
                (d.ownerUserId as { firstName?: string }).firstName,
                (d.ownerUserId as { lastName?: string }).lastName,
              ]
                .filter(Boolean)
                .join(" ") ||
              (d.ownerUserId as { email?: string }).email,
            email: (d.ownerUserId as { email?: string }).email,
          }
        : null;
    return {
      _id: String(d._id),
      schoolName: d.schoolName,
      schoolType: d.schoolType,
      city: d.city,
      region: d.region,
      admin: {
        name:
          [d.adminFirstName, d.adminLastName].filter(Boolean).join(" ") ||
          undefined,
        email: d.adminEmail,
        phone: d.adminPhone,
      },
      status:
        d.status === "submitted" || d.status === "reviewed"
          ? "pending"
          : d.status, // normalize
      archivedAt: d.archivedAt ? new Date(d.archivedAt).toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      pipelineStage: effectiveStage,
      pipelineStageLabel: PIPELINE_STAGE_LABELS[effectiveStage],
      nextActionAt: d.nextActionAt
        ? new Date(d.nextActionAt).toISOString()
        : null,
      owner,
    };
  });

  return NextResponse.json<
    Ok<{ items: typeof dataOut; nextCursor: string | null }>
  >({
    success: true,
    data: { items: dataOut, nextCursor },
  });
}

const BodySchema = z.object({
  adminFirstName: z.string().min(2),
  adminLastName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPhone: z.string().optional(),
  schoolName: z.string().min(3),
  schoolType: z.enum(["Basic", "Secondary"]),
  city: z.string().optional(),
  region: GhanaRegionSchema,
  message: z.string().optional(),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = BodySchema.safeParse(json);
    if (!body.success) {
      console.error(
        "POST /api/platform/applications - Invalid payload:",
        body.error
      );
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await connectToDatabase();

    if (
      body.data.termsVersion !== TERMS_VERSION ||
      body.data.privacyVersion !== PRIVACY_VERSION
    ) {
      return NextResponse.json(
        { error: "Please reload and accept the latest Terms and Privacy Policy." },
        { status: 400 }
      );
    }

    const policyAcceptedIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const policyAcceptedUserAgent = req.headers.get("user-agent") || null;

    const app = await Application.create({
      ...body.data,
      status: "submitted",
      policyAcceptedAt: new Date(),
      policyAcceptedIp,
      policyAcceptedUserAgent,
    });

    console.log("POST /api/platform/applications - Application created:", app);

    await recordApplicationAudit({
      applicationId: app._id,
      action: "submitted",
      by: null, // public submitter
      meta: {
        adminEmail: app.adminEmail,
        schoolName: app.schoolName,
      },
    });

    await writeRetryableAuditEvent({
      actionCode: "application.submitted",
      scopeType: "platform",
      scopeId: null,
      result: "succeeded",
      target: {
        targetEntityType: "Application",
        targetEntityId: app._id,
      },
      context: buildPublicApplicationFormAuditContext(req, {
        idempotencyKey: resolveAuditIdempotencyKey(
          req,
          `application.submitted:${String(app._id)}`
        ),
        submitterEmail: app.adminEmail,
      }),
      payload: {
        metadata: {
          schoolName: app.schoolName,
          schoolType: app.schoolType,
          region: app.region,
        },
      },
    });

    const rendered = renderTemplate("APPLICATION_RECEIVED", {
      name: `${app.adminFirstName}`,
    });
    const confirmationInput = {
      to: `${app.adminEmail}`,
      toName: [app.adminFirstName, app.adminLastName].filter(Boolean).join(" ") || undefined,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      templateKey: "APPLICATION_RECEIVED",
      relatedEntityType: "application",
      relatedEntityId: String(app._id),
    } as const;

    let emailStatus: "sent" | "queued" | "failed" = "failed";
    try {
      const result = await sendTrackedBrevoEmail(confirmationInput);
      emailStatus = result.status === "sent" || result.status === "queued"
        ? result.status
        : "failed";
    } catch (emailError) {
      console.error(
        "POST /api/platform/applications - Immediate confirmation email failed; queueing retry:",
        emailError
      );
      try {
        const queued = await sendTrackedBrevoEmail({
          ...confirmationInput,
          async: true,
        });
        emailStatus = queued.status === "queued" ? "queued" : "failed";
      } catch (queueError) {
        console.error(
          "POST /api/platform/applications - Could not queue confirmation email:",
          queueError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      id: app._id,
      app,
      emailStatus,
    });
  } catch (error) {
    console.error("POST /api/platform/applications - Error:", error);
    console.error(
      "POST /api/platform/applications - Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
