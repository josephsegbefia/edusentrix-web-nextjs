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
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import { pickLessonDeliveryForClass } from "@/lib/lessons/pick-lesson-delivery";
import type { LessonWeekNotebookSummaryResponse } from "@/types/lesson-notebook-summary";

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
      LessonSession.find({
        schoolId: context.schoolId,
        weekPlanId: plan._id,
        status: { $ne: "archived" },
      })
        .sort({ sequenceInWeek: 1 })
        .lean(),
      LessonDelivery.find({ schoolId: context.schoolId, weekPlanId: plan._id }).lean(),
      LessonNote.findById(plan.lessonNoteId).select("topic").lean(),
    ]);

    const deliveriesBySession = new Map<string, typeof deliveries>();
    for (const delivery of deliveries) {
      const key = String(delivery.sessionId);
      const list = deliveriesBySession.get(key) ?? [];
      list.push(delivery);
      deliveriesBySession.set(key, list);
    }

    const rows = sessions.map((s) => {
      const sessionDeliveries = deliveriesBySession.get(String(s._id)) ?? [];
      const delivery = pickLessonDeliveryForClass(
        sessionDeliveries,
        s.classGroupId,
        String(plan.classGroupId),
      );
      const hasNotebookNotes = Boolean(s.boardNotes?.contentHtml?.trim());
      return {
        id: String(s._id),
        sequenceInWeek: s.sequenceInWeek,
        title: s.title,
        scheduledDate: formatDateYmdUtc(new Date(s.scheduledDate)),
        startTime: s.startTime,
        endTime: s.endTime,
        hasNotebookNotes,
        notebookNotesPublished: Boolean(s.notebookNotesPublished),
        notebookNotesHtml: hasNotebookNotes ? s.boardNotes!.contentHtml : null,
        deliveryStatus: delivery?.status ?? null,
      };
    });

    const body: LessonWeekNotebookSummaryResponse = {
      success: true,
      data: {
        weekPlan: {
          id: String(plan._id),
          title: plan.title,
          weekLabel: plan.weekLabel,
          weekStartDate: formatDateYmdUtc(new Date(plan.weekStartDate)),
          weekEndDate: formatDateYmdUtc(new Date(plan.weekEndDate)),
          classGroupId: String(plan.classGroupId),
          lessonNoteTopic: note?.topic ?? null,
        },
        sessions: rows,
        summary: {
          total: rows.length,
          withNotes: rows.filter((r) => r.hasNotebookNotes).length,
          sharedWithStudents: rows.filter((r) => r.notebookNotesPublished).length,
          taught: rows.filter(
            (r) =>
              r.deliveryStatus === "delivered" ||
              r.deliveryStatus === "completed" ||
              r.deliveryStatus === "in_progress",
          ).length,
        },
      },
    };

    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-week-plans notebook-summary GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load notebook summary";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
