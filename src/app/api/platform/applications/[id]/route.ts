/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { ApplicationAudit } from "@/models/ApplicationAudit";
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
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  // platform_admin only
  const me = await User.findOne({ supabaseUserId: data.user.id })
    .select("_id role name email")
    .lean();
  if (!me || (me as any).role !== "platform_admin") return forbidden();

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id))
    return badRequest("Invalid application id");

  const doc = await Application.findById(id).lean();
  if (!doc || Array.isArray(doc)) return notFound("Application not found");

  // Pull real audits
  const audits = await ApplicationAudit.find({ applicationId: doc._id })
    .sort({ createdAt: -1 })
    .lean();

  const adminName =
    [doc.adminFirstName, doc.adminLastName].filter(Boolean).join(" ") ||
    undefined;

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
    linkedSchoolId: doc.linkedSchoolId ? String(doc.linkedSchoolId) : null,
    processedBy: doc.processedBy ? String(doc.processedBy) : null,
    createdAt: doc.createdAt?.toISOString?.(),
    updatedAt: doc.updatedAt?.toISOString?.(),
    raw: doc,
    audit: audits.map((a) => ({
      action: a.action,
      by: a.by ? String(a.by) : undefined,
      at: a.createdAt.toISOString(),
      note: a.note,
    })),
  };

  return NextResponse.json(payload);
}

const PatchSchema = z.object({
  status: z.enum(["submitted", "reviewed"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => (val ? val : undefined)),
});

const ALLOWED_TRANSITIONS: Record<"submitted" | "reviewed", Array<"submitted" | "reviewed">> =
  {
    submitted: ["reviewed"],
    reviewed: ["submitted"],
  };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  const me = await User.findOne({ supabaseUserId: data.user.id })
    .select("_id role name")
    .lean();
  if (!me || (me as any).role !== "platform_admin") return forbidden();

  const { id } = await ctx.params;
  if (!id || !mongoose.isValidObjectId(id))
    return badRequest("Invalid application id");

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Invalid body");

  const doc = await Application.findById(id);
  if (!doc) return notFound("Application not found");

  const nextStatus = parsed.data.status;
  const currentStatus = doc.status as "submitted" | "reviewed" | "approved" | "rejected";

  if (nextStatus === currentStatus) {
    return NextResponse.json({
      success: true,
      status: currentStatus,
    });
  }

  if (
    currentStatus !== "submitted" &&
    currentStatus !== "reviewed"
  ) {
    return NextResponse.json(
      {
        error: `Cannot transition applications in '${currentStatus}' from this endpoint.`,
      },
      { status: 400 }
    );
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

  doc.status = nextStatus;
  if (nextStatus === "reviewed") {
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
