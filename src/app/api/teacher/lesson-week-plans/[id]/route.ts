import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { formatWeekPlanDto } from "@/lib/lessons/format-week-plan";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const planOid = toObjectId(id);
    if (!planOid) {
      return Response.json({ success: false, error: "Invalid week plan ID" }, { status: 400 });
    }

    const plan = await LessonWeekPlan.findOne({
      _id: planOid,
      schoolId: context.schoolId,
      ownerTeacherId: context.teacherId,
    }).lean();

    if (!plan) {
      return Response.json({ success: false, error: "Week plan not found" }, { status: 404 });
    }

    const [sessions, deliveries, note] = await Promise.all([
      LessonSession.find({ weekPlanId: plan._id }).lean(),
      LessonDelivery.find({ weekPlanId: plan._id }).lean(),
      LessonNote.findById(plan.lessonNoteId).select("topic").lean(),
    ]);

    const dto = formatWeekPlanDto({
      plan,
      sessions,
      deliveries,
      lessonNoteTopic: note?.topic ?? null,
    });

    return Response.json({ success: true, data: { weekPlan: dto } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-week-plans/[id] GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load week plan";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
