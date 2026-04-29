import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { randomUUID } from "crypto";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { createDefaultV2Config, ensureConfigV2 } from "@/lib/school-day/migrate-v2";
import {
  normalizeLegacySchoolDailyConfig,
  validateAndNormalizeSchoolDailySchedule,
  zodErrorToMessage,
} from "@/lib/school-day/validateConfig";
import { SchoolDailySchedule } from "@/models/SchoolDailySchedule";
import { Grade } from "@/models/Grade";
import type { SchoolDailyScheduleConfigV2 } from "@/types/school-daily-schedule";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

type HistoryEntryLean = {
  revision?: number;
  savedAt?: Date;
  savedBy?: unknown;
  label?: string;
  academicPeriodId?: unknown;
  config?: unknown;
  scheduleMode?: string;
  scheduleGroups?: unknown;
};

function serializeHistoryEntry(entry: HistoryEntryLean, i: number) {
  const groupsRaw = entry.scheduleGroups;
  const scheduleGroups = Array.isArray(groupsRaw)
    ? groupsRaw.map((g: Record<string, unknown>) => ({
        id: String(g.groupId ?? g.id ?? ""),
        label: g.label != null ? String(g.label) : null,
        gradeIds: Array.isArray(g.gradeIds)
          ? (g.gradeIds as unknown[]).map((id) => String(id))
          : [],
        config:
          g.config != null
            ? ensureConfigV2(normalizeLegacySchoolDailyConfig(g.config) as unknown)
            : null,
      }))
    : null;

  return {
    id: i,
    revision: entry.revision ?? 0,
    savedAt: entry.savedAt ? entry.savedAt.toISOString() : null,
    savedBy: entry.savedBy ? String(entry.savedBy) : null,
    label: entry.label ?? null,
    academicPeriodId: entry.academicPeriodId
      ? String(entry.academicPeriodId)
      : null,
    scheduleMode: entry.scheduleMode === "grouped" ? "grouped" : "unified",
    scheduleGroups,
    config: entry.config
      ? ensureConfigV2(normalizeLegacySchoolDailyConfig(entry.config) as unknown)
      : null,
  };
}

function serializeDoc(doc: Record<string, unknown>) {
  const mode = doc.scheduleMode === "grouped" ? "grouped" : "unified";
  const rawHistory = doc.scheduleHistory as unknown[] | undefined;
  const history = Array.isArray(rawHistory)
    ? rawHistory.map((e, i) => serializeHistoryEntry((e as HistoryEntryLean) || {}, i))
    : [];

  /** Grouped mode must never be serialized as unified — avoid wrong badge when `scheduleGroups` is missing from the lean doc. */
  if (mode === "grouped") {
    const rawGroups = doc.scheduleGroups;
    const arr = Array.isArray(rawGroups) ? rawGroups : [];
    const scheduleGroups = (
      arr as Array<{
        groupId?: string;
        label?: string;
        gradeIds?: unknown[];
        config?: unknown;
      }>
    ).map((g) => ({
      id: String(g.groupId ?? g.id ?? ""),
      label: g.label != null && String(g.label).trim() ? String(g.label).trim() : null,
      gradeIds: (g.gradeIds ?? []).map((id) => String(id)),
      config:
        g.config != null
          ? ensureConfigV2(normalizeLegacySchoolDailyConfig(g.config) as unknown)
          : createDefaultV2Config(),
    }));
    return {
      id: String(doc._id),
      scheduleMode: "grouped" as const,
      config: null,
      scheduleGroups,
      revision: (doc.revision as number) ?? 0,
      history,
      updatedAt:
        (doc.updatedAt as Date | undefined)?.toISOString?.() ??
        null,
      createdAt:
        (doc.createdAt as Date | undefined)?.toISOString?.() ??
        null,
    };
  }

  const config = doc.config
    ? ensureConfigV2(normalizeLegacySchoolDailyConfig(doc.config) as unknown)
    : createDefaultV2Config();

  return {
    id: String(doc._id),
    scheduleMode: "unified" as const,
    config,
    scheduleGroups: null,
    revision: (doc.revision as number) ?? 0,
    history,
    updatedAt:
      (doc.updatedAt as Date | undefined)?.toISOString?.() ??
      null,
    createdAt:
      (doc.createdAt as Date | undefined)?.toISOString?.() ??
      null,
  };
}

function hasStoredSchedule(doc: Record<string, unknown>) {
  const groups = doc.scheduleGroups;
  return doc.config != null || (Array.isArray(groups) && groups.length > 0);
}

async function validateGroupedSchedule(
  schoolOid: mongoose.Types.ObjectId,
  groups: Array<{
    id?: string;
    label?: string | null;
    gradeIds: string[];
    config: unknown;
  }>
): Promise<
  | {
      ok: true;
      groups: Array<{
        groupId: string;
        label: string;
        gradeIds: mongoose.Types.ObjectId[];
        config: SchoolDailyScheduleConfigV2;
      }>;
      warnings: string[];
    }
  | { ok: false; error: string }
> {
  if (!groups?.length) {
    return { ok: false, error: "Add at least one schedule group." };
  }

  const grades = await Grade.find({ schoolId: schoolOid, isActive: true })
    .select("_id")
    .lean();
  const allIds = new Set(grades.map((g) => String(g._id)));

  if (allIds.size === 0) {
    return {
      ok: false,
      error:
        "Add at least one active grade before using different schedules per group.",
    };
  }

  const seen = new Set<string>();
  const out: Array<{
    groupId: string;
    label: string;
    gradeIds: mongoose.Types.ObjectId[];
    config: SchoolDailyScheduleConfigV2;
  }> = [];
  const allWarnings: string[] = [];

  for (let gi = 0; gi < groups.length; gi += 1) {
    const g = groups[gi];
    if (!g.gradeIds?.length) {
      return {
        ok: false,
        error: `Group ${gi + 1}: assign at least one grade, or merge it with another group.`,
      };
    }
    const oidList: mongoose.Types.ObjectId[] = [];
    for (const id of g.gradeIds) {
      const s = String(id);
      if (!mongoose.Types.ObjectId.isValid(s) || !allIds.has(s)) {
        return { ok: false, error: `Invalid or unknown grade: ${s}` };
      }
      if (seen.has(s)) {
        return { ok: false, error: "Each grade may only appear in one schedule group." };
      }
      seen.add(s);
      oidList.push(new mongoose.Types.ObjectId(s));
    }

    const validated = validateAndNormalizeSchoolDailySchedule(g.config);
    if (!validated.ok) {
      if (validated.details) {
        return { ok: false, error: zodErrorToMessage(validated.details) };
      }
      return { ok: false, error: validated.error };
    }
    allWarnings.push(...validated.warnings);

    out.push({
      groupId: g.id?.trim() || randomUUID(),
      label: (g.label ?? "").trim(),
      gradeIds: oidList,
      config: validated.config,
    });
  }

  if (seen.size !== allIds.size) {
    return {
      ok: false,
      error:
        "Every active grade must belong to exactly one schedule group. Use a solo group for a grade that differs from the rest.",
    };
  }

  return { ok: true, groups: out, warnings: allWarnings };
}

/**
 * GET — load the school’s daily schedule (one document per school), or null.
 */
export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    const docs = await SchoolDailySchedule.find({ schoolId })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .lean()
      .exec();
    const doc = docs.find((candidate) =>
      hasStoredSchedule(candidate as Record<string, unknown>)
    );
    if (!doc) {
      return NextResponse.json({ success: true, data: null });
    }
    const data = serializeDoc(doc as Record<string, unknown>) as Record<string, unknown>;
    if (docs.length > 1) {
      data.orphanedDocumentCount = docs.length - 1;
    }
    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}

/**
 * PUT — create or replace daily schedule (unified or grouped).
 */
export async function PUT(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    const body = (await req.json()) as {
      scheduleMode?: "unified" | "grouped";
      config?: unknown;
      scheduleGroups?: Array<{
        id?: string;
        label?: string | null;
        gradeIds: string[];
        config: unknown;
      }>;
      changeLabel?: string;
      academicPeriodId?: string;
    };

    const scheduleMode: "unified" | "grouped" =
      body.scheduleMode === "grouped" ? "grouped" : "unified";

    await connectToDatabase();
    const schoolOid = new mongoose.Types.ObjectId(String(schoolId));

    let validatedUnified: {
      config: SchoolDailyScheduleConfigV2;
      warnings: string[];
    } | null = null;
    let validatedGroups: Array<{
      groupId: string;
      label: string;
      gradeIds: mongoose.Types.ObjectId[];
      config: SchoolDailyScheduleConfigV2;
    }> | null = null;
    const groupWarnings: string[] = [];

    if (scheduleMode === "grouped") {
      if (!body.scheduleGroups?.length) {
        return jsonError("Grouped mode requires scheduleGroups", 400);
      }
      const vg = await validateGroupedSchedule(schoolOid, body.scheduleGroups);
      if (!vg.ok) {
        return jsonError(vg.error, 400);
      }
      validatedGroups = vg.groups;
      groupWarnings.push(...vg.warnings);
    } else {
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
      validatedUnified = {
        config: validated.config,
        warnings: validated.warnings,
      };
    }

    const existing = await SchoolDailySchedule.findOne({ schoolId: schoolOid })
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .lean()
      .exec();

    const nextRevision = ((existing?.revision as number) ?? 0) + 1;
    const ex = existing as Record<string, unknown> | null;

    const hasPriorSnapshot =
      ex &&
      (ex.config != null ||
        (Array.isArray(ex.scheduleGroups) && ex.scheduleGroups.length > 0));

    const historyEntry = hasPriorSnapshot
      ? {
          revision: (ex!.revision as number) ?? 0,
          savedAt: new Date(),
          savedBy: userId,
          label: (body.changeLabel || "").trim() || undefined,
          academicPeriodId: body.academicPeriodId
            ? mongoose.Types.ObjectId.isValid(String(body.academicPeriodId))
              ? new mongoose.Types.ObjectId(String(body.academicPeriodId))
              : undefined
            : undefined,
          scheduleMode: (ex!.scheduleMode as string) === "grouped" ? "grouped" : "unified",
          scheduleGroups: ex!.scheduleGroups,
          config: ex!.config,
        }
      : null;

    const nextHistory = historyEntry
      ? [...((ex?.scheduleHistory as unknown[]) ?? []), historyEntry].slice(-30)
      : (ex?.scheduleHistory as unknown[]) ?? [];

    const setPayload: Record<string, unknown> = {
      scheduleMode,
      updatedBy: userId,
      revision: nextRevision,
      scheduleHistory: nextHistory,
    };

    if (scheduleMode === "unified" && validatedUnified) {
      setPayload.config = validatedUnified.config;
      setPayload.scheduleGroups = [];
    } else if (scheduleMode === "grouped" && validatedGroups) {
      setPayload.config = null;
      setPayload.scheduleGroups = validatedGroups.map((g) => ({
        groupId: g.groupId,
        label: g.label,
        gradeIds: g.gradeIds,
        config: g.config,
      }));
    }

    const doc = await SchoolDailySchedule.findOneAndUpdate(
      { schoolId: schoolOid },
      { $set: setPayload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!doc) {
      return jsonError("Failed to save schedule", 500);
    }

    const warnings = [
      ...(validatedUnified?.warnings ?? []),
      ...groupWarnings,
    ];

    const data = serializeDoc(doc.toObject() as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        warnings,
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
    await SchoolDailySchedule.deleteMany({ schoolId });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    const err = e as { message?: string };
    return jsonError(err?.message || "Server error", 500);
  }
}
