import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { TimetableConflict, type TimetableConflictCode } from "@/models/TimetableConflict";
import { TimetableVersion } from "@/models/TimetableVersion";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function parsePositiveInt(value: string | null, defaultValue: number, max = 200): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, max);
}

const CONFLICT_CODES: TimetableConflictCode[] = [
  "TEACHER_OVERLAP",
  "CLASS_OVERLAP",
  "INVALID_TIME_RANGE",
  "MISSING_TEACHER",
  "MISSING_SUBJECT",
  "MISSING_CLASSGROUP",
  "MISSING_CLASSROOM_LABEL",
  "OUTSIDE_PERIOD_RANGE",
  "TEACHER_PENDING_ASSIGNMENT",
];

/**
 * GET /api/admin/timetable/versions/:versionId/conflicts
 * Filters: page, limit, status, severity, code, search
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ versionId: string }> }
) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const authCtx = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const authSchoolId = new mongoose.Types.ObjectId(String(authCtx.schoolId));
    const { versionId } = await ctx.params;
    const versionObjId = toObjectIdOrNull(versionId);
    if (!versionObjId) {
      return NextResponse.json(
        { success: false, error: "versionId must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const version = await TimetableVersion.findOne({
      _id: versionObjId,
      schoolId: authSchoolId,
    })
      .select("_id status academicPeriodId")
      .lean();
    if (!version) {
      return NextResponse.json(
        { success: false, error: "Timetable version not found for school." },
        { status: 404 }
      );
    }

    const schoolIdObj = authSchoolId;

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1, 10000);
    const limit = parsePositiveInt(searchParams.get("limit"), 100, 500);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const code = searchParams.get("code");
    const search = searchParams.get("search")?.trim();

    if (status && !["open", "resolved", "ignored"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "status must be one of: open, resolved, ignored." },
        { status: 400 }
      );
    }
    if (severity && !["error", "warning"].includes(severity)) {
      return NextResponse.json(
        { success: false, error: "severity must be one of: error, warning." },
        { status: 400 }
      );
    }
    if (code && !CONFLICT_CODES.includes(code as TimetableConflictCode)) {
      return NextResponse.json(
        { success: false, error: "Invalid conflict code." },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
      versionId: versionObjId,
    };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (code) filter.code = code;
    if (search) {
      filter.message = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    const [items, total, openErrorCount] = await Promise.all([
      TimetableConflict.find(filter)
        .sort({ severity: -1, createdAt: -1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TimetableConflict.countDocuments(filter),
      TimetableConflict.countDocuments({
        schoolId: schoolIdObj,
        versionId: versionObjId,
        status: "open",
        severity: "error",
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map((item) => ({
        id: String(item._id),
        schoolId: String(item.schoolId),
        academicPeriodId: String(item.academicPeriodId),
        versionId: String(item.versionId),
        code: item.code,
        severity: item.severity,
        status: item.status,
        message: item.message,
        slotIds: (item.slotIds || []).map((id: mongoose.Types.ObjectId) => String(id)),
        metadata: item.metadata || {},
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
      })),
      meta: {
        version: {
          id: String((version as { _id: mongoose.Types.ObjectId })._id),
          status: String((version as { status: string }).status),
          academicPeriodId: String(
            (version as { academicPeriodId: mongoose.Types.ObjectId }).academicPeriodId
          ),
        },
        blockers: {
          openErrorCount,
          publishBlocked: openErrorCount > 0,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to list timetable conflicts:", e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Failed to list timetable conflicts.",
      },
      { status: 500 }
    );
  }
}
