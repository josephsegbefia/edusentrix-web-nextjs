/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { sendEmail } from "@/lib/email/brevo";
import { z } from "zod";
import { Types } from "mongoose";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import { GhanaRegionSchema } from "@/constants/ghanaRegions";

// Optional: ensure useful indexes in your model file (shown below).
// applicationSchema.index({ status: 1, createdAt: -1 });
// applicationSchema.index({ schoolType: 1 });
// applicationSchema.index({ adminEmail: 1 });
// applicationSchema.index({ schoolName: 1 });

type Ok<T> = { success: true; data: T };
type Fail = { success: false; error: string };

function daysAgoToDate(key?: string | null) {
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending|approved|rejected|all
  const type = url.searchParams.get("type"); // Basic|Secondary|all
  const q = url.searchParams.get("q")?.trim();
  const range = url.searchParams.get("range"); // 7d|30d|90d
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
  const cursor = url.searchParams.get("cursor"); // last _id string

  // Auth + role enforcement (API side)
  const guard = await requirePlatformAdmin();
  console.log("guard", guard);
  if (!guard.ok) return guard.res;

  await connectToDatabase();
  const me = guard.me;
  if (!me || me.role !== "platform_admin") {
    return NextResponse.json<Fail>(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  // Build Mongo filter
  const filter: any = {};
  const statusFilter = buildStatusFilter(status);
  if (statusFilter) filter.status = statusFilter;
  if (type && type !== "all") filter.schoolType = type;

  // Date range
  const from = daysAgoToDate(range);
  filter.createdAt = { $gte: from };

  // Text search
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { schoolName: rx },
      { adminEmail: rx },
      { adminFirstName: rx },
      { adminLastName: rx },
      { city: rx },
      { region: rx },
    ];
  }

  // Cursor (by _id desc)
  if (cursor && Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new Types.ObjectId(cursor) };
  }

  const docs = await Application.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? String(items[items.length - 1]._id) : null;

  // Shape to UI type and normalize status
  const dataOut = items.map((d) => ({
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
    createdAt: d.createdAt.toISOString(),
  }));

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

    const app = await Application.create({
      ...body.data,
      status: "submitted",
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

    // Fire and forget OK for UX (await to stface errors during hardening)
    try {
      await sendEmail(`${app.adminEmail}`, "APPLICATION_RECEIVED", {
        name: `${app.adminFirstName}`,
      });
    } catch (emailError) {
      console.error(
        "POST /api/platform/applications - Email send failed:",
        emailError
      );
      // Don't fail the request if email fails
    }

    return NextResponse.json({ success: true, id: app._id, app: app });
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
