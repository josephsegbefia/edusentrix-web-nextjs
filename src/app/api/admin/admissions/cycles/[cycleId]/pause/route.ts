// src/app/api/admin/admissions/cycles/[cycleId]/pause/route.ts
// POST pause an admission cycle (transitions published → paused).

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { AdmissionEvent } from "@/models/AdmissionEvent";
import { recordAdmissionsManagerActivity } from "@/lib/admissions/recordAdmissionsManagerActivity";
import { serializeAdmissionCycle } from "@/lib/admissions/service";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

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
    requireAdmissionsPermission(ctx, "admissions.manage_cycle");
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

    if (cycle.status !== "published") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot pause a cycle in status "${cycle.status}"`,
        },
        { status: 409 }
      );
    }

    const userId = toObjectId(ctx.userId);
    cycle.status = "paused";
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
      kind: "cycle.paused",
    });

    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.cycle.paused",
      entityType: "AdmissionCycle",
      entityId: cycle._id,
      description: `Paused admission cycle: ${cycle.name}`,
      delegationAction: "admissions.cycle.paused",
      metadata: {
        cycleId: String(cycle._id),
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeAdmissionCycle(cycle.toObject() as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions cycle pause error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to pause cycle" },
      { status: 500 }
    );
  }
}
