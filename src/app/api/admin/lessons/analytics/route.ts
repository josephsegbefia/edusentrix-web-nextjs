import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import {
  defaultLessonAnalyticsRange,
  getLessonAnalytics,
  type LessonAnalyticsResult,
} from "@/lib/lessons/admin-analytics.service";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      );
    }

    const def = defaultLessonAnalyticsRange();
    const from = parsed.data.from ? new Date(parsed.data.from) : def.from;
    const to = parsed.data.to ? new Date(parsed.data.to) : def.to;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid date range" }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ success: false, error: "from must be before to" }, { status: 400 });
    }

    const data: LessonAnalyticsResult = await getLessonAnalytics(context.schoolId, from, to);

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Admin lesson analytics failed:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
