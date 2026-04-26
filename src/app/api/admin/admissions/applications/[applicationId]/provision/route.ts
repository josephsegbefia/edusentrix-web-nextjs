// src/app/api/admin/admissions/applications/[applicationId]/provision/route.ts
// POST – idempotently create the Student + Guardian + parent User for an
// already-accepted admissions application. Optionally sends a Clerk parent
// invite. Returns the same payload (with `alreadyProvisioned: true`) when
// called twice for the same application.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import {
  provisionApplication,
  ProvisioningServiceError,
} from "@/lib/admissions/provisioning-service";

type Params = Promise<{ applicationId: string }>;

const Body = z.object({
  targetClassGroupId: z.string().optional().nullable(),
  targetGradeId: z.string().optional().nullable(),
  sendParentInvite: z.boolean().optional().default(true),
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

    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json ?? {});
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

    const result = await provisionApplication({
      applicationId,
      schoolId: ctx.schoolId,
      actorUserId: ctx.userId,
      actorRole: ctx.isAdmin ? "school_admin" : "admissions_officer",
      actorLabel: ctx.isAdmin ? "School admin" : "Admissions officer",
      targetGradeId: parsed.data.targetGradeId ?? null,
      targetClassGroupId: parsed.data.targetClassGroupId ?? null,
      sendParentInvite: parsed.data.sendParentInvite ?? true,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProvisioningServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    console.error("Admissions provisioning error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to provision application" },
      { status: 500 }
    );
  }
}
