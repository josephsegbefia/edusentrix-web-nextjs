import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonAuditLog } from "@/models/LessonAuditLog";
import type { AdminLessonAuditRow } from "@/types/lesson-audit";
import { actorLabelsForUserIds } from "@/lib/lessons/audit-actor-labels";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(0).optional().default(0),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  lessonId: z.string().optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const { page, limit } = parsed.data;
    const enrichActors = req.nextUrl.searchParams.get("enrichActors") !== "false";
    const lessonIdParam = parsed.data.lessonId?.trim();

    const filter: Record<string, unknown> = { schoolId: context.schoolId };
    if (lessonIdParam) {
      const oid = toObjectIdOrNull(lessonIdParam);
      if (!oid) {
        return NextResponse.json({ success: false, error: "Invalid lessonId" }, { status: 400 });
      }
      filter.lessonId = oid;
    }

    const skip = page * limit;
    const rows = await LessonAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const actorLabelMap = enrichActors
      ? await actorLabelsForUserIds(slice.map((r) => new mongoose.Types.ObjectId(String(r.actorId))))
      : null;

    const entries: AdminLessonAuditRow[] = slice.map((r) => ({
      id: String(r._id),
      lessonId: String(r.lessonId),
      actorId: String(r.actorId),
      ...(actorLabelMap
        ? { actorLabel: actorLabelMap.get(String(r.actorId)) ?? undefined }
        : {}),
      action: r.action,
      metadata:
        r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : {},
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
    }));

    return NextResponse.json({
      success: true,
      data: { entries, hasMore, page, limit },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Admin lesson audit log failed:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
