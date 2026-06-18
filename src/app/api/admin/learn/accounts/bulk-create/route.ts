import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { createLearnAccountForStudent } from "@/lib/learn/admin-account-service";
import { findLearnEligibleStudentIdsWithoutAccounts } from "@/lib/learn/grade-eligibility";

const BulkCreateLearnAccountsSchema = z.union([
  z.object({
    studentIds: z.array(z.string().trim().min(1)).min(1).max(100),
  }),
  z.object({
    allEligible: z.literal(true),
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();

    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const learnGate = await requireSchoolFeature(ctx.schoolId, FEATURE_KEYS.LEARN_MANAGE);
    if (!learnGate.allowed) {
      return NextResponse.json(
        { success: false, error: learnGate.reason },
        { status: learnGate.statusCode ?? 403 },
      );
    }

    const raw = await req.json().catch(() => null);
    const parsed = BulkCreateLearnAccountsSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid bulk account payload." },
        { status: 400 },
      );
    }

    const studentIds =
      "allEligible" in parsed.data
        ? (await findLearnEligibleStudentIdsWithoutAccounts(ctx.schoolId)).map(String)
        : Array.from(new Set(parsed.data.studentIds));

    if (!studentIds.length) {
      return NextResponse.json({
        success: true,
        data: {
          results: [],
          created: 0,
          failed: 0,
          requested: 0,
        },
      });
    }

    const { enforceLearnSeatLimit } = await import("@/lib/subscriptions/guards");
    const seatResult = await enforceLearnSeatLimit({
      schoolId: ctx.schoolId,
      increment: studentIds.length,
    });
    if (!seatResult.allowed) {
      return NextResponse.json(
        { success: false, error: seatResult.reason ?? "Learn seat limit reached." },
        { status: seatResult.statusCode ?? 403 },
      );
    }

    const invalid = studentIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalid.length) {
      return NextResponse.json(
        { success: false, error: "One or more student ids are invalid." },
        { status: 400 },
      );
    }

    const results = [];
    for (const studentId of studentIds) {
      const result = await createLearnAccountForStudent({
        schoolId: ctx.schoolId,
        studentId: new Types.ObjectId(studentId),
        actorUserId: ctx.userId,
      });
      results.push(
        result.ok
          ? { studentId, success: true, data: result.data }
          : { studentId, success: false, error: result.error },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        created: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
        requested: studentIds.length,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[admin/learn/accounts/bulk-create:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to bulk create Learn accounts." },
      { status: 500 },
    );
  }
}
