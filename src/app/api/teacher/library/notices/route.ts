import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  listPublishedLibraryNoticesForPatron,
  serializeLibraryNoticePatron,
} from "@/lib/library/library-notice.service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTeacher();
    await connectToDatabase();
    const rawLimit = Number(new URL(req.url).searchParams.get("limit"));
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;
    const notices = await listPublishedLibraryNoticesForPatron(
      ctx.schoolId,
      {
        kind: "teacher",
        homeroomClassGroupId: ctx.homeroomClassGroupId ?? null,
      },
      { limit }
    );
    return NextResponse.json({
      success: true,
      data: { items: notices.map(serializeLibraryNoticePatron) },
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
