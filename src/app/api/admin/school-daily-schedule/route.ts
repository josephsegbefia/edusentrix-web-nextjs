import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { ensureConfigV2 } from "@/lib/school-day/migrate-v2";
import {
  normalizeLegacySchoolDailyConfig,
  validateAndNormalizeSchoolDailySchedule,
  zodErrorToMessage,
} from "@/lib/school-day/validateConfig";
import { SchoolDailySchedule } from "@/models/SchoolDailySchedule";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function serializeHistoryEntry(
  entry: {
    revision?: number;
    savedAt?: Date;
    savedBy?: unknown;
    label?: string;
    academicPeriodId?: unknown;
    config?: unknown;
  },
  i: number
) {
  return {
    id: i,
    revision: entry.revision ?? 0,
    savedAt: entry.savedAt ? entry.savedAt.toISOString() : null,
    savedBy: entry.savedBy ? String(entry.savedBy) : null,
    label: entry.label ?? null,
    academicPeriodId: entry.academicPeriodId
      ? String(entry.academicPeriodId)
      : null,
    config: entry.config
      ? ensureConfigV2(
          normalizeLegacySchoolDailyConfig(entry.config) as unknown
        )
      : null,
  };
}

/**
 * GET — load the school’s daily schedule (one document per school), or null.
 */
export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    const doc = await SchoolDailySchedule.findOne({ schoolId })
      .lean()
      .exec();
    if (!doc) {
      return NextResponse.json({ success: true, data: null });
    }
    const config = ensureConfigV2(
      normalizeLegacySchoolDailyConfig(doc.config) as unknown
    );
    const rawHistory = (doc as { scheduleHistory?: unknown[] }).scheduleHistory;
    const history = Array.isArray(rawHistory)
      ? rawHistory.map((e, i) => serializeHistoryEntry((e as never) || {}, i))
      : [];
    return NextResponse.json({
      success: true,
      data: {
        id: String(doc._id),
        config,
        revision: (doc as { revision?: number }).revision ?? 0,
        history,
        updatedAt: doc.updatedAt?.toISOString?.() ?? null,
        createdAt: doc.createdAt?.toISOString?.() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}

/**
 * PUT — create or replace the daily schedule, append prior config to version history.
 */
export async function PUT(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    const body = (await req.json()) as {
      config?: unknown;
      changeLabel?: string;
      academicPeriodId?: string;
    };
    if (!body?.config) {
      return jsonError("Missing config", 400);
    }
    const validated = validateAndNormalizeSchoolDailySchedule(body.config);
    if (!validated.ok) {
      if (validated.details) {
        return jsonError(zodErrorToMessage(validated.details), 400);
      }
      return jsonError(validated.error, 400);
    }
    await connectToDatabase();
    const schoolOid = new mongoose.Types.ObjectId(String(schoolId));
    const existing = await SchoolDailySchedule.findOne({ schoolId: schoolOid })
      .lean()
      .exec();

    const nextRevision = (existing?.revision ?? 0) + 1;
    const ex = existing as
      | { config?: unknown; revision?: number; scheduleHistory?: unknown[] }
      | null;
    const historyEntry =
      ex?.config != null
        ? {
            revision: ex.revision ?? 0,
            savedAt: new Date(),
            savedBy: userId,
            label: (body.changeLabel || "").trim() || undefined,
            academicPeriodId: body.academicPeriodId
              ? (mongoose.Types.ObjectId.isValid(String(body.academicPeriodId))
                  ? new mongoose.Types.ObjectId(String(body.academicPeriodId))
                  : undefined)
              : undefined,
            config: ex.config,
          }
        : null;
    const nextHistory = historyEntry
      ? [ ...(ex?.scheduleHistory ?? []), historyEntry].slice(-30)
      : (ex?.scheduleHistory ?? []) ?? [];

    const doc = await SchoolDailySchedule.findOneAndUpdate(
      { schoolId: schoolOid },
      {
        $set: {
          config: validated.config,
          updatedBy: userId,
          revision: nextRevision,
          scheduleHistory: nextHistory,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!doc) {
      return jsonError("Failed to save schedule", 500);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(doc._id),
        config: doc.config,
        revision: doc.revision ?? nextRevision,
        warnings: validated.warnings,
        updatedAt: doc.updatedAt?.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}

/**
 * DELETE — remove the daily schedule (e.g. to start fresh).
 */
export async function DELETE() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    await SchoolDailySchedule.deleteOne({ schoolId });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}
