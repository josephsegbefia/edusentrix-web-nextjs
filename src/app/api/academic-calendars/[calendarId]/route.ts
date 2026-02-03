import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { AcademicCalendarEvent } from "@/models/AcademicCalendarEvent";
import { resolveEditorIds } from "@/lib/academic-calendar/editors";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  academicPeriodId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  editors: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ calendarId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectToDatabase();

  const { calendarId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId)) {
    return NextResponse.json({ error: "Invalid calendar ID" }, { status: 400 });
  }

  const raw = await req.json();
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    updatedBy: context.userId,
  };

  if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    update.description = parsed.data.description?.trim() || null;
  }
  if (parsed.data.color !== undefined) update.color = parsed.data.color || null;
  if (parsed.data.isPublished !== undefined) update.isPublished = parsed.data.isPublished;

  if (parsed.data.academicPeriodId !== undefined) {
    update.academicPeriodId = parsed.data.academicPeriodId
      ? new mongoose.Types.ObjectId(parsed.data.academicPeriodId)
      : null;
  }

  if (parsed.data.editors !== undefined) {
    update.editors = await resolveEditorIds({
      schoolId: context.schoolId as mongoose.Types.ObjectId,
      editorIds: parsed.data.editors,
    });
  }

  const updated = await AcademicCalendar.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(calendarId), schoolId: context.schoolId },
    { $set: update },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ calendarId: string }> }
) {
  const context = await requireSchoolMember({ allowedRoles: ["teacher", "bursar"] });
  if (!context.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectToDatabase();
  const { calendarId } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(calendarId)) {
    return NextResponse.json({ error: "Invalid calendar ID" }, { status: 400 });
  }

  const calendarObjId = new mongoose.Types.ObjectId(calendarId);

  const calendar = await AcademicCalendar.findOne({
    _id: calendarObjId,
    schoolId: context.schoolId,
  });

  if (!calendar) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  await AcademicCalendarEvent.deleteMany({ calendarId: calendarObjId });
  await AcademicCalendar.deleteOne({ _id: calendarObjId });

  return NextResponse.json({ success: true });
}
