import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TimetableVersion } from "@/models/TimetableVersion";
import { isTimetableApiWriteEnabled } from "@/lib/timetable/feature-flags";
import { recordTimetableActivity } from "@/lib/timetable/audit";

interface CreateVersionBody {
  academicPeriodId?: string;
  name?: string;
  baseVersionId?: string | null;
}

function toObjectIdOrNull(value: string | null | undefined): mongoose.Types.ObjectId | null {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildDefaultDraftName(): string {
  const iso = new Date().toISOString().replace("T", " ").slice(0, 16);
  return `Draft ${iso} UTC`;
}

/**
 * GET /api/admin/timetable/versions?academicPeriodId=...
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
    const academicPeriodId = searchParams.get("academicPeriodId");

    const academicPeriodObjId = toObjectIdOrNull(academicPeriodId);
    if (!academicPeriodObjId) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId is required and must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const period = await AcademicPeriod.findOne({
      _id: academicPeriodObjId,
      schoolId: schoolIdObj,
    })
      .select("_id yearLabel term")
      .lean();

    if (!period) {
      return NextResponse.json(
        { success: false, error: "Academic period not found for school." },
        { status: 404 }
      );
    }

    const versions = await TimetableVersion.find({
      schoolId: schoolIdObj,
      academicPeriodId: academicPeriodObjId,
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const data = (versions || []).map((version) => ({
      id: String(version._id),
      schoolId: String(version.schoolId),
      academicPeriodId: String(version.academicPeriodId),
      name: version.name,
      status: version.status,
      baseVersionId: version.baseVersionId ? String(version.baseVersionId) : null,
      publishedAt: version.publishedAt ? new Date(version.publishedAt).toISOString() : null,
      stale: Boolean(version.stale),
      staleReasons: Array.isArray(version.staleReasons)
        ? version.staleReasons.map((reason) => ({
            sourceModule: reason.sourceModule,
            sourceEntityId: reason.sourceEntityId ? String(reason.sourceEntityId) : null,
            message: reason.message,
            createdAt: reason.createdAt ? new Date(reason.createdAt).toISOString() : null,
          }))
        : [],
      lockVersion: version.lockVersion,
      createdBy: String(version.createdBy),
      updatedBy: String(version.updatedBy),
      createdAt: new Date(version.createdAt).toISOString(),
      updatedAt: new Date(version.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: {
        academicPeriod: {
          id: String((period as { _id: mongoose.Types.ObjectId })._id),
          yearLabel: String((period as { yearLabel: string }).yearLabel),
          term: String((period as { term: string }).term),
        },
      },
    });
  } catch (e: unknown) {
    console.error("Failed to list timetable versions:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to list versions." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/timetable/versions
 * Body: { academicPeriodId, name?, baseVersionId? }
 */
export async function POST(req: NextRequest) {
  try {
    if (!isTimetableApiWriteEnabled()) {
      return NextResponse.json(
        { success: false, error: "Timetable admin planner is disabled." },
        { status: 404 }
      );
    }

    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "timetable.edit",
    ]);
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));
    const body = (await req.json()) as CreateVersionBody;

    const academicPeriodObjId = toObjectIdOrNull(body.academicPeriodId);
    if (!academicPeriodObjId) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId is required and must be a valid ObjectId." },
        { status: 400 }
      );
    }

    const periodExists = await AcademicPeriod.exists({
      _id: academicPeriodObjId,
      schoolId: schoolIdObj,
    });
    if (!periodExists) {
      return NextResponse.json(
        { success: false, error: "Academic period not found for school." },
        { status: 404 }
      );
    }

    const baseVersionObjId = toObjectIdOrNull(body.baseVersionId ?? null);
    if (body.baseVersionId && !baseVersionObjId) {
      return NextResponse.json(
        { success: false, error: "baseVersionId must be a valid ObjectId when provided." },
        { status: 400 }
      );
    }

    if (baseVersionObjId) {
      const baseVersion = await TimetableVersion.findOne({
        _id: baseVersionObjId,
        schoolId: schoolIdObj,
        academicPeriodId: academicPeriodObjId,
      })
        .select("_id")
        .lean();
      if (!baseVersion) {
        return NextResponse.json(
          { success: false, error: "baseVersionId does not belong to this school/academic period." },
          { status: 400 }
        );
      }
    }

    const normalizedName = normalizeSpaces(body.name || "");
    const name = normalizedName || buildDefaultDraftName();

    const created = await TimetableVersion.create({
      schoolId: schoolIdObj,
      academicPeriodId: academicPeriodObjId,
      name,
      status: "draft",
      baseVersionId: baseVersionObjId ?? null,
      publishedAt: null,
      createdBy: userIdObj,
      updatedBy: userIdObj,
      lockVersion: 0,
    });

    await recordTimetableActivity({
      schoolId: schoolIdObj,
      userId: userIdObj,
      type: "timetable.version.created",
      description: "Created timetable draft version",
      entityType: "TimetableVersion",
      entityId: created._id,
      metadata: {
        academicPeriodId: String(academicPeriodObjId),
        baseVersionId: created.baseVersionId ? String(created.baseVersionId) : null,
        name: created.name,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(created._id),
          schoolId: String(created.schoolId),
          academicPeriodId: String(created.academicPeriodId),
          name: created.name,
          status: created.status,
          baseVersionId: created.baseVersionId ? String(created.baseVersionId) : null,
          publishedAt: created.publishedAt ? created.publishedAt.toISOString() : null,
          stale: Boolean(created.stale),
          staleReasons: [],
          lockVersion: created.lockVersion,
          createdBy: String(created.createdBy),
          updatedBy: String(created.updatedBy),
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("Failed to create timetable version:", e);
    const message =
      e instanceof Error ? e.message : "Failed to create timetable version.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
