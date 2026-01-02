/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { ApplicationAudit } from "@/models/ApplicationAudit";
import { School } from "@/models/School";
import mongoose from "mongoose";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";

function forbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}
function badRequest(msg = "Bad request") {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  // platform_admin only
  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("_id role name email")
    .lean();
  const me = Array.isArray(meRaw) ? meRaw[0] : meRaw;
  if (!me || (me as any).role !== "platform_admin") return forbidden();

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id))
    return badRequest("Invalid application id");

  const doc = await Application.findById(id)
    .populate("linkedSchoolId", "name type status city region")
    .populate("processedBy", "firstName lastName email name")
    .lean();

  if (!doc || Array.isArray(doc)) return notFound("Application not found");

  // Pull real audits
  const audits = await ApplicationAudit.find({ applicationId: doc._id })
    .populate("by", "firstName lastName email name")
    .sort({ createdAt: -1 })
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

  const payload = {
    _id: String(doc._id),
    schoolName: doc.schoolName,
    schoolType: doc.schoolType,
    city: doc.city,
    region: doc.region,
    status: doc.status,
    admin: {
      firstName: doc.adminFirstName,
      lastName: doc.adminLastName,
      email: doc.adminEmail,
      phone: doc.adminPhone,
      name: adminName,
    },
    linkedSchool: linkedSchool,
    linkedSchoolId: doc.linkedSchoolId ? String(doc.linkedSchoolId) : null,
    processedBy: processedByUser,
    processedById: doc.processedBy ? String(doc.processedBy) : null,
    createdAt: doc.createdAt?.toISOString?.(),
    updatedAt: doc.updatedAt?.toISOString?.(),
    raw: doc,
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
      at: a.createdAt.toISOString(),
      note: a.note,
    })),
  };

  return NextResponse.json(payload);
}

const PatchSchema = z.object({
  status: z.enum(["submitted", "reviewed", "approved", "rejected"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => (val ? val : undefined)),
});

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

  const nextStatus = parsed.data.status;
  const currentStatus = doc.status as
    | "submitted"
    | "reviewed"
    | "approved"
    | "rejected";

  if (nextStatus === currentStatus) {
    return NextResponse.json({
      success: true,
      status: currentStatus,
    });
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(nextStatus)) {
    return NextResponse.json(
      {
        error: `Transition from '${currentStatus}' to '${nextStatus}' is not allowed.`,
      },
      { status: 400 }
    );
  }

  // Handle school status updates when changing approved applications
  if (currentStatus === "approved" && doc.linkedSchoolId) {
    const school = await School.findById(doc.linkedSchoolId);
    if (school) {
      if (nextStatus === "submitted" || nextStatus === "rejected") {
        // Update school to deactivated when application is rejected or returned to submitted
        school.status = "deactivated";
        await school.save();
      } else if (nextStatus === "reviewed") {
        // Keep school as pending when moving to reviewed
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
    doc.processedBy = (me as any)._id;
  } else if (nextStatus === "submitted") {
    doc.processedBy = null;
  }
  await doc.save();

  await recordApplicationAudit({
    applicationId: doc._id,
    action: nextStatus,
    by: (me as any)._id,
    note: parsed.data.note,
  });

  return NextResponse.json({
    success: true,
    status: doc.status,
  });
}
