import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { defaultLessonAnalyticsRange } from "@/lib/lessons/admin-analytics.service";
import {
  getTeacherLessonAnalytics,
  type TeacherLessonAnalyticsResult,
} from "@/lib/lessons/teacher-analytics.service";
import { gateLessonsFeature, gateLessonsModule } from "@/lib/lessons/lesson-gates";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await gateLessonsModule(context.schoolId);
    if (!moduleGate.ok) {
      return NextResponse.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const analyticsGate = gateLessonsFeature(
      moduleGate.settings,
      "enableLessonAnalytics",
      "Lesson analytics",
    );
    if (!analyticsGate.ok) {
      return NextResponse.json(
        { success: false, error: analyticsGate.error },
        { status: analyticsGate.status },
      );
    }

    if (!can(context.permissions, PERMISSIONS.lessonAnalyticsView)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

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

    const data: TeacherLessonAnalyticsResult = await getTeacherLessonAnalytics(
      context.schoolId,
      context.teacherId,
      from,
      to
    );

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Teacher lesson analytics failed:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
