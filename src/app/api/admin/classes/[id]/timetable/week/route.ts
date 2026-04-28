import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { ClassGroup } from "@/models/ClassGroup";
import {
  getPublishedWeekTimetable,
  parseDateInput,
} from "@/lib/timetable/read-model";
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
 * GET /api/admin/classes/:id/timetable/week?date=YYYY-MM-DD
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
    const classObjId = toObjectIdOrNull(id);
    if (!classObjId) {
      return NextResponse.json(
        { success: false, error: "id must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const classExists = await ClassGroup.exists({
      _id: classObjId,
      schoolId: schoolIdObj,
    });
    if (!classExists) {
      return NextResponse.json(
        { success: false, error: "Class group not found for school." },
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

    const weekly = await getPublishedWeekTimetable({
      schoolId: schoolIdObj,
      targetDate: targetDate || new Date(),
      scope: "class",
      classGroupId: classObjId,
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
    console.error("Failed to fetch class week timetable:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to fetch class week timetable.",
      },
      { status: 500 }
    );
  }
}
