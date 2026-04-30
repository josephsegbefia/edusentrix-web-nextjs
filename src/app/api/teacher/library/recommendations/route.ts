import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { recommendLibraryBooksForBorrower } from "@/lib/library/library-recommendations.service";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTeacher();
    await connectToDatabase();
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(sp);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const items = await recommendLibraryBooksForBorrower(
      ctx.schoolId,
      "teacher",
      ctx.teacherId,
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
