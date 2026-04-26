// src/app/api/admin/admissions/cycles/[cycleId]/publish/route.ts
// POST publish an admission cycle (transitions draft|paused → published).

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { recordActivity } from "@/lib/audit/recordActivity";
import { serializeAdmissionCycle } from "@/lib/admissions/service";

function toObjectId(value: unknown): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(String(value));
}

function isValidObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ cycleId: string }> }
) {
  try {
    const ctx = await requireAdmissionsManager();
    const { cycleId } = await context.params;
    if (!isValidObjectId(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }
    await connectToDatabase();

    const cycle = await AdmissionCycle.findOne({
      _id: cycleId,
      schoolId: ctx.schoolId,
    });
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }

    if (!["draft", "paused"].includes(cycle.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot publish a cycle in status "${cycle.status}"`,
        },
        { status: 409 }
      );
    }

    const userId = toObjectId(ctx.userId);
    const wasFirstPublish = !cycle.publishedAt;
    cycle.status = "published";
    if (wasFirstPublish) cycle.publishedAt = new Date();
    cycle.updatedBy = userId;
    await cycle.save();

    await AdmissionEvent.create({
      schoolId: ctx.schoolId,
      cycleId: cycle._id,
      actor: {
        userId,
        role: ctx.isAdmin ? "school_admin" : "admissions_officer",
        label: "Admissions manager",
      },
      kind: "cycle.published",
      metadata: { firstPublish: wasFirstPublish },
    });

    await recordActivity({
      schoolId: ctx.schoolId,
      userId,
      type: "admissions.cycle.published",
      entityType: "AdmissionCycle",
      entityId: cycle._id,
      description: `Published admission cycle: ${cycle.name}`,
      metadata: { cycleId: String(cycle._id), slug: cycle.slug },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionCycle(cycle.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycle publish error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to publish cycle" },
      { status: 500 }
    );
  }
}
