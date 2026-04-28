import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { TimetableVersion } from "@/models/TimetableVersion";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";
import { buildTimetableParityReport } from "@/lib/timetable/parity";

function toObjectIdOrNull(
  value: string | null | undefined
): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function parseMaxExamples(value: string | null): number {
  if (!value) return 20;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
}

/**
 * GET /api/admin/timetable/parity?academicPeriodId=&versionId=&maxExamples=
 */
export async function GET(req: NextRequest) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("timetable");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);
    let academicPeriodIdObj = toObjectIdOrNull(searchParams.get("academicPeriodId"));
    let versionIdObj = toObjectIdOrNull(searchParams.get("versionId"));
    const maxExamples = parseMaxExamples(searchParams.get("maxExamples"));

    if (searchParams.get("academicPeriodId") && !academicPeriodIdObj) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    if (searchParams.get("versionId") && !versionIdObj) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    if (versionIdObj) {
      const version = await TimetableVersion.findOne({
        _id: versionIdObj,
        schoolId: schoolIdObj,
      })
        .select("_id academicPeriodId status")
        .lean();

      if (!version) {
        return NextResponse.json(
          { success: false, error: "versionId does not belong to this school." },
          { status: 404 }
        );
      }

      const versionStatus = String((version as { status: string }).status);
      if (versionStatus !== "draft" && versionStatus !== "published") {
        return NextResponse.json(
          {
            success: false,
            error: "versionId must reference a draft or published timetable version.",
          },
          { status: 400 }
        );
      }

      const versionPeriodId = (version as { academicPeriodId: mongoose.Types.ObjectId })
        .academicPeriodId;

      if (
        academicPeriodIdObj &&
        String(academicPeriodIdObj) !== String(versionPeriodId)
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "academicPeriodId does not match the academic period of the provided versionId.",
          },
          { status: 400 }
        );
      }

      academicPeriodIdObj = versionPeriodId;
      versionIdObj = (version as { _id: mongoose.Types.ObjectId })._id;
    }

    const report = await buildTimetableParityReport({
      schoolId: schoolIdObj,
      academicPeriodId: academicPeriodIdObj,
      versionId: versionIdObj,
      maxExamples,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (e: unknown) {
    console.error("Failed to build timetable parity report:", e);
    return NextResponse.json(
      {
        success: false,
        error:
          e instanceof Error ? e.message : "Failed to build timetable parity report.",
      },
      { status: 500 }
    );
  }
}
