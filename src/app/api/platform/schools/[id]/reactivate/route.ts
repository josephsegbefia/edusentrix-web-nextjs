import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import {
  SchoolActiveTransitionError,
  transitionSchoolToActive,
} from "@/lib/platform/schools/transition-to-active";

const ReactivationSchema = z.object({
  reason: z.string().trim().min(8, "Reactivation reason is required.").max(1000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePlatformPermission("platform.schools.activate");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid school id." }, { status: 400 });
    }

    const parsed = ReactivationSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Reactivation reason is required." },
        { status: 400 },
      );
    }

    const result = await transitionSchoolToActive({
      req,
      schoolId: new mongoose.Types.ObjectId(id),
      actor: { userId: gate.actor.userId, email: gate.actor.email },
      reason: parsed.data.reason,
      kind: "reactivation",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof SchoolActiveTransitionError) {
      if (error.code === "SCHOOL_NOT_FOUND") {
        return NextResponse.json({ success: false, error: "School not found." }, { status: 404 });
      }
      return NextResponse.json(
        {
          success: false,
          error: "This school is not eligible for reactivation from its current lifecycle state.",
          code: "INVALID_LIFECYCLE_STATE",
          currentStatus: error.currentStatus ?? null,
        },
        { status: 409 },
      );
    }
    console.error("platform school reactivate:", error);
    return NextResponse.json(
      { success: false, error: "School reactivation could not be completed. No lifecycle change was committed." },
      { status: 500 },
    );
  }
}
