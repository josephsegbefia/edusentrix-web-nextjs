/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { ApplicationAudit } from "@/models/ApplicationAudit";
import { School } from "@/models/School";
import mongoose from "mongoose";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import {
  APPLICATION_PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  resolveEffectivePipelineStage,
} from "@/constants/application-pipeline";

function forbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}
function badRequest(msg = "Bad request") {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

const APPLICATION_DETAIL_AUDIT_LIMIT = 300;

/** Avoid NextResponse.json throwing on circular / non-JSON Mixed fields (e.g. audit meta). */
function toJsonSafe(value: unknown): unknown {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { _error: "Could not serialize value as JSON" };
  }
}

function auditTimestampIso(a: unknown): string {
  if (!a || typeof a !== "object" || !("createdAt" in a)) {
    return new Date(0).toISOString();
  }
  const raw = (a as { createdAt?: unknown }).createdAt;
  if (raw == null) return new Date(0).toISOString();
  const d = new Date(raw as Date | string);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

function refIdString(
  ref: unknown
): string | null {
  if (ref == null) return null;
  if (typeof ref === "object" && ref !== null && "_id" in ref) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePlatformAdmin();
    if (!guard.ok) return guard.res;

    await connectToDatabase();

    const { id } = await ctx.params;
    if (!id || !mongoose.isValidObjectId(id))
      return badRequest("Invalid application id");

    const doc = await Application.findById(id)
      .populate("linkedSchoolId", "name type status city region")
      .populate("processedBy", "firstName lastName email name")
      .populate("ownerUserId", "firstName lastName email name")
      .populate("enrolledStudentId", "firstName lastName admissionNo")
      .lean();

    if (!doc || Array.isArray(doc)) return notFound("Application not found");

    const audits = await ApplicationAudit.find({ applicationId: doc._id })
      .populate("by", "firstName lastName email name")
      .sort({ createdAt: -1 })
      .limit(APPLICATION_DETAIL_AUDIT_LIMIT)
      .lean();

  const adminName =
    [doc.adminFirstName, doc.adminLastName].filter(Boolean).join(" ") ||
    undefined;

  const linkedSchool =
    doc.linkedSchoolId && typeof doc.linkedSchoolId === "object"
      ? {
          _id: String(doc.linkedSchoolId._id),
          name: doc.linkedSchoolId.name,
          type: doc.linkedSchoolId.type,
          status: doc.linkedSchoolId.status,
          city: doc.linkedSchoolId.city,
          region: doc.linkedSchoolId.region,
        }
      : null;

  const processedByUser =
    doc.processedBy && typeof doc.processedBy === "object"
      ? {
          _id: String(doc.processedBy._id),
          name:
            doc.processedBy.name ||
            [doc.processedBy.firstName, doc.processedBy.lastName]
              .filter(Boolean)
              .join(" ") ||
            doc.processedBy.email,
          email: doc.processedBy.email,
        }
      : null;

  const ownerUser =
    doc.ownerUserId && typeof doc.ownerUserId === "object"
      ? {
          _id: String(doc.ownerUserId._id),
          name:
            doc.ownerUserId.name ||
            [doc.ownerUserId.firstName, doc.ownerUserId.lastName]
              .filter(Boolean)
              .join(" ") ||
            doc.ownerUserId.email,
          email: doc.ownerUserId.email,
        }
      : null;

  const effectiveStage = resolveEffectivePipelineStage({
    stage: doc.stage,
    status: doc.status,
  });
  const pipelineStageLabel =
    PIPELINE_STAGE_LABELS[
      effectiveStage as keyof typeof PIPELINE_STAGE_LABELS
    ] ?? String(effectiveStage);

  const enrolledStudent =
    doc.enrolledStudentId && typeof doc.enrolledStudentId === "object"
      ? {
          _id: String(doc.enrolledStudentId._id),
          firstName: doc.enrolledStudentId.firstName,
          lastName: doc.enrolledStudentId.lastName,
          admissionNo: doc.enrolledStudentId.admissionNo ?? null,
        }
      : null;

  const payload = {
    _id: String(doc._id),
    schoolName: doc.schoolName,
    schoolType: doc.schoolType,
    city: doc.city,
    region: doc.region,
    status: doc.status,
    pipelineStage: effectiveStage,
    pipelineStageLabel,
    stagePersisted: Boolean(doc.stage),
    nextActionAt: doc.nextActionAt
      ? new Date(doc.nextActionAt).toISOString()
      : null,
    owner: ownerUser,
    ownerUserId: doc.ownerUserId
      ? typeof doc.ownerUserId === "object"
        ? String(doc.ownerUserId._id)
        : String(doc.ownerUserId)
      : null,
    admin: {
      firstName: doc.adminFirstName,
      lastName: doc.adminLastName,
      email: doc.adminEmail,
      phone: doc.adminPhone,
      name: adminName,
    },
    linkedSchool: linkedSchool,
    linkedSchoolId: refIdString(doc.linkedSchoolId),
    enrolledStudentId: doc.enrolledStudentId
      ? typeof doc.enrolledStudentId === "object"
        ? String(doc.enrolledStudentId._id)
        : String(doc.enrolledStudentId)
      : null,
    enrolledStudent,
    processedBy: processedByUser,
    processedById: refIdString(doc.processedBy),
    createdAt: doc.createdAt?.toISOString?.(),
    updatedAt: doc.updatedAt?.toISOString?.(),
    raw: toJsonSafe(doc) as Record<string, unknown>,
    audit: audits.map((a) => ({
      action: a.action,
      by:
        a.by && typeof a.by === "object"
          ? {
              _id: String(a.by._id),
              name:
                a.by.name ||
                [a.by.firstName, a.by.lastName].filter(Boolean).join(" ") ||
                a.by.email,
              email: a.by.email,
            }
          : undefined,
      at: auditTimestampIso(a),
      note: a.note,
      meta: toJsonSafe(a.meta ?? null),
    })),
  };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("GET /api/platform/applications/[id]", err);
    return NextResponse.json(
      { error: "Failed to load application" },
      { status: 500 }
    );
  }
}

const PipelinePatchSchema = z.object({
  stage: z.enum(APPLICATION_PIPELINE_STAGES).optional(),
  nextActionAt: z.union([z.string().datetime(), z.null()]).optional(),
  ownerUserId: z.union([z.string(), z.null()]).optional(),
});

const PatchSchema = z
  .object({
    status: z.enum(["submitted", "reviewed", "approved", "rejected"]).optional(),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((val) => (val ? val : undefined)),
    pipeline: PipelinePatchSchema.optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      (d.pipeline !== undefined &&
        (d.pipeline.stage !== undefined ||
          d.pipeline.nextActionAt !== undefined ||
          d.pipeline.ownerUserId !== undefined)),
    { message: "Provide status or pipeline fields" }
  );

const ALLOWED_TRANSITIONS: Record<
  "submitted" | "reviewed" | "approved" | "rejected",
  Array<"submitted" | "reviewed" | "approved" | "rejected">
> = {
  submitted: ["reviewed"],
  reviewed: ["submitted", "approved", "rejected"],
  approved: ["submitted", "rejected"],
  rejected: ["submitted", "reviewed", "approved"],
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("_id role name")
    .lean();
  const me = Array.isArray(meRaw) ? meRaw[0] : meRaw;
  if (!me || (me as any).role !== "platform_admin") return forbidden();

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id))
    return badRequest("Invalid application id");

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid body");

  const doc = await Application.findById(id);
  if (!doc) return notFound("Application not found");

  const meId = (me as any)._id as mongoose.Types.ObjectId;

  // --- status workflow (optional) ---
  if (parsed.data.status !== undefined) {
    const nextStatus = parsed.data.status;
    const currentStatus = doc.status as
      | "submitted"
      | "reviewed"
      | "approved"
      | "rejected";

    if (nextStatus !== currentStatus) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(nextStatus)) {
        return NextResponse.json(
          {
            error: `Transition from '${currentStatus}' to '${nextStatus}' is not allowed.`,
          },
          { status: 400 }
        );
      }

      if (currentStatus === "approved" && doc.linkedSchoolId) {
        const school = await School.findById(doc.linkedSchoolId);
        if (school) {
          if (nextStatus === "submitted" || nextStatus === "rejected") {
            school.status = "deactivated";
            await school.save();
          } else if (nextStatus === "reviewed") {
            school.status = "pending";
            await school.save();
          }
        }
      }

      doc.status = nextStatus;
      if (
        nextStatus === "reviewed" ||
        nextStatus === "approved" ||
        nextStatus === "rejected"
      ) {
        doc.processedBy = meId;
      } else if (nextStatus === "submitted") {
        doc.processedBy = null;
      }

      await doc.save();

      await recordApplicationAudit({
        applicationId: doc._id,
        action: nextStatus,
        by: meId,
        note: parsed.data.note,
      });
    }
  }

  // --- pipeline (optional) ---
  if (parsed.data.pipeline) {
    const p = parsed.data.pipeline;
    const changes: Array<{
      field: string;
      from: unknown;
      to: unknown;
    }> = [];

    if (p.stage !== undefined) {
      const prev = doc.stage ?? null;
      if (prev !== p.stage) {
        changes.push({ field: "stage", from: prev, to: p.stage });
        doc.stage = p.stage;
      }
    }

    if (p.nextActionAt !== undefined) {
      const prevIso = doc.nextActionAt
        ? new Date(doc.nextActionAt).toISOString()
        : null;
      const nextVal =
        p.nextActionAt === null ? null : new Date(p.nextActionAt);
      const nextIso = nextVal ? nextVal.toISOString() : null;
      if (prevIso !== nextIso) {
        changes.push({
          field: "nextActionAt",
          from: prevIso,
          to: nextIso,
        });
        doc.nextActionAt = nextVal;
      }
    }

    if (p.ownerUserId !== undefined) {
      if (p.ownerUserId === null) {
        if (doc.ownerUserId) {
          changes.push({
            field: "ownerUserId",
            from: String(doc.ownerUserId),
            to: null,
          });
          doc.ownerUserId = null;
        }
      } else {
        if (!mongoose.isValidObjectId(p.ownerUserId)) {
          return badRequest("Invalid owner user id");
        }
        const owner = await User.findById(p.ownerUserId).select("role").lean();
        if (!owner || (owner as any).role !== "platform_admin") {
          return NextResponse.json(
            { error: "Owner must be a platform admin user." },
            { status: 400 }
          );
        }
        const nextOwner = new mongoose.Types.ObjectId(p.ownerUserId);
        if (String(doc.ownerUserId ?? "") !== String(nextOwner)) {
          changes.push({
            field: "ownerUserId",
            from: doc.ownerUserId ? String(doc.ownerUserId) : null,
            to: String(nextOwner),
          });
          doc.ownerUserId = nextOwner as any;
        }
      }
    }

    if (changes.length > 0) {
      await doc.save();
      await recordApplicationAudit({
        applicationId: doc._id,
        action: "pipeline_updated",
        by: meId,
        meta: { changes },
      });
    }
  }

  return NextResponse.json({
    success: true,
    status: doc.status,
  });
}
