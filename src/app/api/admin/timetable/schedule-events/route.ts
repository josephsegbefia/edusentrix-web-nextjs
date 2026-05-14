import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { ScheduleChangeEvent } from "@/models/ScheduleChangeEvent";

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/timetable/schedule-events?academicPeriodId=...&after=...&limit=...
 *
 * Lightweight polling endpoint for timetable consistency events. The UI can use this later
 * for live refresh prompts without changing the slot write contract.
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("timetable");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);
    const academicPeriodId = toObjectIdOrNull(searchParams.get("academicPeriodId"));
    const after = searchParams.get("after");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);

    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (academicPeriodId) query.academicPeriodId = academicPeriodId;
    if (after) {
      const afterDate = new Date(after);
      if (!Number.isNaN(afterDate.getTime())) {
        query.createdAt = { $gt: afterDate };
      }
    }

    const events = await ScheduleChangeEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: events.map((event) => ({
        id: String(event._id),
        schoolId: String(event.schoolId),
        academicPeriodId: event.academicPeriodId ? String(event.academicPeriodId) : null,
        entityType: event.entityType,
        entityId: String(event.entityId),
        action: event.action,
        affectedClassGroupIds: (event.affectedClassGroupIds || []).map(String),
        affectedTeacherIds: (event.affectedTeacherIds || []).map(String),
        affectedSubjectIds: (event.affectedSubjectIds || []).map(String),
        affectedRoomIds: (event.affectedRoomIds || []).map(String),
        message: event.message ?? null,
        createdAt: new Date(event.createdAt).toISOString(),
      })),
    });
  } catch (e: unknown) {
    console.error("Failed to list schedule change events:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to list schedule events." },
      { status: 500 }
    );
  }
}
