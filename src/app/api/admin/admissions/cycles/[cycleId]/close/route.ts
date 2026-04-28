// src/app/api/admin/admissions/cycles/[cycleId]/close/route.ts
// POST close an admission cycle (transitions any active status → closed).

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

    if (cycle.status === "closed" || cycle.status === "archived") {
      return NextResponse.json(
        {
          success: false,
          error: `Cycle is already ${cycle.status}`,
        },
        { status: 409 }
      );
    }

    const userId = toObjectId(ctx.userId);
    cycle.status = "closed";
    cycle.closedAt = new Date();
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
      kind: "cycle.closed",
    });

    await recordAdmissionsManagerActivity({
      ctx,
      type: "admissions.cycle.closed",
      entityType: "AdmissionCycle",
      entityId: cycle._id,
      description: `Closed admission cycle: ${cycle.name}`,
      delegationAction: "admissions.cycle.closed",
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
    console.error("Admissions cycle close error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to close cycle" },
      { status: 500 }
    );
  }
}
