// src/app/api/admin/admissions/applications/[applicationId]/decision/route.ts
// POST – record an Accept / Reject / Waitlist decision and (optionally) email
// the applicant. Provisioning (creating the Student/Guardian) is handled by
// the sibling `/provision` route so admins can take it as a separate step.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import {
  recordDecision,
  DecisionServiceError,
} from "@/lib/admissions/decision-service";

type Params = Promise<{ applicationId: string }>;

const Body = z.object({
  outcome: z.enum(["accepted", "rejected", "waitlisted"]),
  notes: z.string().max(5000).optional().nullable(),
  targetGradeId: z.string().optional().nullable(),
  targetClassGroupId: z.string().optional().nullable(),
  sendEmail: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    const { applicationId } = await params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json(
        { success: false, error: "Invalid application id" },
        { status: 400 }
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await recordDecision({
      applicationId,
      schoolId: ctx.schoolId,
      decidedBy: ctx.userId,
      decidedByLabel: ctx.isAdmin ? "School admin" : "Admissions officer",
      decidedByRole: ctx.isAdmin ? "school_admin" : "admissions_officer",
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? null,
      targetGradeId: parsed.data.targetGradeId ?? null,
      targetClassGroupId: parsed.data.targetClassGroupId ?? null,
      sendEmail: parsed.data.sendEmail ?? true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof DecisionServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Admissions decision error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record decision" },
      { status: 500 }
    );
  }
}
