import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { Teacher } from "@/models/Teacher";
import {
  parseDateInput,
} from "@/lib/timetable/read-model";
import { buildTeacherWeekAgenda } from "@/lib/teacher/buildTeacherWeekAgenda";
import {
  isTimetableRebootEnabled,
  isTimetableRoleReadViewsEnabled,
} from "@/lib/timetable/feature-flags";

function toObjectIdOrNull(value: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/timetable/week?date=YYYY-MM-DD
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    if (!isTimetableRebootEnabled() || !isTimetableRoleReadViewsEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable read views are disabled." },
        { status: 404 }
      );
    }

    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("timetable");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { id } = await ctx.params;
    const teacherObjId = toObjectIdOrNull(id);
    if (!teacherObjId) {
      return NextResponse.json(
        { success: false, error: "id must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const teacherExists = await Teacher.exists({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    });
    if (!teacherExists) {
      return NextResponse.json(
        { success: false, error: "Teacher not found for school." },
        { status: 404 }
      );
    }

    const dateParam = req.nextUrl.searchParams.get("date");
    const targetDate = dateParam ? parseDateInput(dateParam) : new Date();
    if (dateParam && !targetDate) {
      return NextResponse.json(
        { success: false, error: "date must be a valid YYYY-MM-DD value." },
        { status: 400 }
      );
    }

    const weekly = await buildTeacherWeekAgenda({
      schoolId: schoolIdObj,
      targetDate: targetDate || new Date(),
      teacherId: teacherObjId,
    });

    return NextResponse.json({
      success: true,
      data: weekly,
    });
  } catch (e: unknown) {
    console.error("Failed to fetch teacher week timetable:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to fetch teacher week timetable.",
      },
      { status: 500 }
    );
  }
}
