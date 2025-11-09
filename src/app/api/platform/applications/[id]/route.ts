/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Application } from "@/models/Application";
import { ApplicationAudit } from "@/models/ApplicationAudit";
import mongoose from "mongoose";

function forbidden(msg = "Forbidden") {
  return NextResponse.json({ error: msg }, { status: 403 });
}
function badRequest(msg = "Bad request") {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function notFound(msg = "Not found") {
  return NextResponse.json({ error: msg }, { status: 404 });
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  // platform_admin only
  const me = await User.findOne({ supabaseUserId: data.user.id })
    .select("role")
    .lean();
  if (!me || (me as any).role !== "platform_admin") return forbidden();

  const { id } = ctx.params;
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
