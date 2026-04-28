import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { resolveEditorIds } from "@/lib/academic-calendar/editors";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  academicPeriodId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  editors: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const context = await requireSchoolMember({
    allowedRoles: ["teacher", "bursar", "staff"],
  });
  await connectToDatabase();

  const url = new URL(req.url);
  const includeAll = url.searchParams.get("all") === "1";

  const query: Record<string, unknown> = {
    schoolId: context.schoolId,
  };

  if (!context.isAdmin && !includeAll) {
    query.editors = context.userId;
  }

  const calendars = await AcademicCalendar.find(query)
    .sort({ createdAt: -1 })
    .lean();

  const data = calendars.map((c) => ({
    id: String(c._id),
    name: c.name,
    description: c.description || null,
    academicPeriodId: c.academicPeriodId ? String(c.academicPeriodId) : null,
    color: c.color || null,
    isPublished: c.isPublished ?? false,
    editors: context.isAdmin
      ? (c.editors || []).map((id) => String(id))
      : undefined,
    canEdit:
      context.isAdmin ||
      (c.editors || []).some((id) => String(id) === String(context.userId)),
    createdAt: c.createdAt?.toISOString?.() ?? null,
    updatedAt: c.updatedAt?.toISOString?.() ?? null,
  }));

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const context = await requireSchoolMember({
    allowedRoles: ["teacher", "bursar", "staff"],
  });
  if (!context.isAdmin) {
    const perms = await mergedDelegationPermissions(
      context.schoolId,
      context.userId
    );
    if (!perms.includes("calendar.create") && !perms.includes("calendar.edit")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  await connectToDatabase();

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const editorIds = await resolveEditorIds({
    schoolId: context.schoolId as mongoose.Types.ObjectId,
    editorIds: parsed.data.editors || [],
  });

  const doc = await AcademicCalendar.create({
    schoolId: context.schoolId,
    academicPeriodId: parsed.data.academicPeriodId
      ? new mongoose.Types.ObjectId(parsed.data.academicPeriodId)
      : null,
    name: parsed.data.name.trim(),
    description: parsed.data.description?.trim() || null,
    color: parsed.data.color || null,
    isPublished: parsed.data.isPublished ?? false,
    editors: editorIds,
    createdBy: context.userId,
    updatedBy: context.userId,
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id: String(doc._id),
      },
    },
    { status: 201 }
  );
}
