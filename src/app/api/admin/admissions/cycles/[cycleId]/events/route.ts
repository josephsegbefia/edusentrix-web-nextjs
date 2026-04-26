// src/app/api/admin/admissions/cycles/[cycleId]/events/route.ts
// GET — paginated audit timeline for a single admissions cycle.
// Query params:
//   ?limit=50    (5..200, default 50)
//   ?before=<ISO date>   pagination cursor for older events
//   ?applicationId=<id>  optional filter to a single application

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { User } from "@/models/User";

type Params = { cycleId: string };

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const ctx = await requireAdmissionsManager();
    await connectToDatabase();
    const { cycleId } = await params;

    if (!mongoose.Types.ObjectId.isValid(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }

    const cycle = await AdmissionCycle.findOne({
      _id: cycleId,
      schoolId: ctx.schoolId,
    })
      .select({ _id: 1 })
      .lean();
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "50");
    const limit = Math.min(200, Math.max(5, Number.isFinite(limitRaw) ? limitRaw : 50));
    const before = url.searchParams.get("before");
    const applicationId = url.searchParams.get("applicationId");

    const filter: Record<string, unknown> = {
      schoolId: ctx.schoolId,
      cycleId: new mongoose.Types.ObjectId(cycleId),
    };
    if (applicationId && mongoose.Types.ObjectId.isValid(applicationId)) {
      filter.applicationId = new mongoose.Types.ObjectId(applicationId);
    }
    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        filter.at = { $lt: beforeDate };
      }
    }

    const events = await AdmissionEvent.find(filter)
      .sort({ at: -1 })
      .limit(limit)
      .lean();

    // Resolve actor labels lazily — most events already carry `actor.label`,
    // but we still hydrate a name from User in case it was not stamped.
    const missingActorIds = Array.from(
      new Set(
        events
          .filter((e) => !e.actor?.label && e.actor?.userId)
          .map((e) => String(e.actor!.userId))
      )
    );
    const actorMap = new Map<string, { name: string }>();
    if (missingActorIds.length > 0) {
      const users = await User.find({ _id: { $in: missingActorIds } })
        .select({ _id: 1, firstName: 1, lastName: 1 })
        .lean();
      for (const u of users) {
        actorMap.set(String(u._id), {
          name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Staff member",
        });
      }
    }

    const data = events.map((e) => ({
      id: String(e._id),
      kind: e.kind,
      at: (e.at instanceof Date ? e.at : new Date(e.at as unknown as string)).toISOString(),
      applicationId: e.applicationId ? String(e.applicationId) : null,
      actor: {
        userId: e.actor?.userId ? String(e.actor.userId) : null,
        role: e.actor?.role ?? null,
        label:
          e.actor?.label ||
          (e.actor?.userId
            ? actorMap.get(String(e.actor.userId))?.name ?? "Staff member"
            : "System"),
      },
      metadata: (e.metadata as Record<string, unknown> | undefined) ?? {},
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        nextCursor:
          data.length === limit ? data[data.length - 1].at : null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin admissions events GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load events" },
      { status: 500 }
    );
  }
}
