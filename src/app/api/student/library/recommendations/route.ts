import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { recommendLibraryBooksForBorrower } from "@/lib/library/library-recommendations.service";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";
import { Student } from "@/models/Student";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const schoolId = ctx.schoolId as unknown as mongoose.Types.ObjectId;
    const student = await Student.findOne({
      userId: ctx.userId,
      schoolId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Student record not found" } },
        { status: 404 }
      );
    }
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(sp);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const items = await recommendLibraryBooksForBorrower(
      schoolId,
      "student",
      student._id as mongoose.Types.ObjectId,
      parsed.data.limit
    );
    return NextResponse.json({
      success: true,
      data: { items: items.map(serializeLibraryBookPatron) },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
