/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { ReconciliationRun } from "@/models/ReconciliationRun";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const limit = Math.min(
      50,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20))
    );

    const runs = await ReconciliationRun.find({ schoolId: schoolIdObj })
      .sort({ startedAt: -1 })
      .limit(limit)
      .populate("triggeredBy", "firstName lastName name email")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        runs: runs.map((run: any) => ({
          id: String(run._id),
          mode: run.mode,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt || null,
          summary: run.summary || null,
          notes: run.notes || null,
          errorMessage: run.errorMessage || null,
          triggeredBy: run.triggeredBy
            ? {
                id: String(run.triggeredBy._id),
                firstName: run.triggeredBy.firstName || null,
                lastName: run.triggeredBy.lastName || null,
                name: run.triggeredBy.name || null,
                email: run.triggeredBy.email || null,
              }
            : null,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch reconciliation runs.",
      },
      { status: 500 }
    );
  }
}
