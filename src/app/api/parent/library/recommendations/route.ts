import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { recommendLibraryBooksForWardStudents } from "@/lib/library/library-recommendations.service";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    const schoolId = ctx.schoolId as unknown as mongoose.Types.ObjectId;
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(sp);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const items = await recommendLibraryBooksForWardStudents(
      schoolId,
      wardIds,
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
