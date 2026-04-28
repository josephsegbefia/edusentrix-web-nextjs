import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import {
  getPublishedWeekTimetable,
  parseDateInput,
  type TimetableScope,
} from "@/lib/timetable/read-model";
import {
  isTimetableRebootEnabled,
  isTimetableRoleReadViewsEnabled,
} from "@/lib/timetable/feature-flags";

function toObjectIdOrNull(value: string | null): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function isScope(value: string | null): value is TimetableScope {
  return value === "school" || value === "class" || value === "teacher" || value === "student";
}

/**
 * GET /api/timetable/week?date=YYYY-MM-DD&scope=school|class|teacher|student
 */
export async function GET(req: NextRequest) {
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
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get("date");
    const scopeParam = searchParams.get("scope");

    if (!dateParam) {
      return NextResponse.json(
        { success: false, error: "date is required in YYYY-MM-DD format." },
        { status: 400 }
      );
    }
    if (!isScope(scopeParam)) {
      return NextResponse.json(
        { success: false, error: "scope must be one of: school, class, teacher, student." },
        { status: 400 }
      );
    }

    const targetDate = parseDateInput(dateParam);
    if (!targetDate) {
      return NextResponse.json(
        { success: false, error: "date must be a valid YYYY-MM-DD value." },
        { status: 400 }
      );
    }

    const classGroupId = toObjectIdOrNull(searchParams.get("classGroupId"));
    const teacherId = toObjectIdOrNull(searchParams.get("teacherId"));
    const studentId = toObjectIdOrNull(searchParams.get("studentId"));

    if (searchParams.get("classGroupId") && !classGroupId) {
      return NextResponse.json(
        { success: false, error: "classGroupId must be a valid ObjectId." },
        { status: 400 }
      );
    }
    if (searchParams.get("teacherId") && !teacherId) {
      return NextResponse.json(
        { success: false, error: "teacherId must be a valid ObjectId." },
        { status: 400 }
      );
    }
    if (searchParams.get("studentId") && !studentId) {
      return NextResponse.json(
        { success: false, error: "studentId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const weekly = await getPublishedWeekTimetable({
      schoolId: schoolIdObj,
      targetDate,
      scope: scopeParam,
      classGroupId,
      teacherId,
      studentId,
    });

    if ("error" in weekly) {
      return NextResponse.json(
        { success: false, error: weekly.error },
        { status: weekly.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: weekly.data,
      meta: {
        publishedVersionId: weekly.publishedVersionId,
        publishedAt: weekly.publishedAt,
        noPublishedVersion: weekly.noPublishedVersion,
      },
    });
  } catch (e: unknown) {
    console.error("Failed to fetch timetable week:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to fetch week timetable.",
      },
      { status: 500 }
    );
  }
}
