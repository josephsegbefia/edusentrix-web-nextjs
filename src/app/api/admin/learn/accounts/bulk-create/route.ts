import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { createLearnAccountForStudent } from "@/lib/learn/admin-account-service";

const BulkCreateLearnAccountsSchema = z.object({
  studentIds: z.array(z.string().trim().min(1)).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    const parsed = BulkCreateLearnAccountsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid bulk account payload." },
        { status: 400 }
      );
    }

    const studentIds = Array.from(new Set(parsed.data.studentIds));
    const invalid = studentIds.filter((id) => !Types.ObjectId.isValid(id));
    if (invalid.length) {
      return NextResponse.json(
        { success: false, error: "One or more student ids are invalid." },
        { status: 400 }
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
          : { studentId, success: false, error: result.error }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        created: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/accounts/bulk-create:POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to bulk create Learn accounts." },
      { status: 500 }
    );
  }
}
