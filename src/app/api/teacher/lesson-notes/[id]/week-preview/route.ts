import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { formatDateYmdUtc } from "@/lib/lessons/timetable-slots-for-week";
import type { LessonWeekPreviewResponse } from "@/types/lesson-preview";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  req: Request,
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
    const noteOid = toObjectId(id);
    if (!noteOid) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const note = await LessonNote.findOne({
      _id: noteOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id topic classGroupId")
      .lean();

    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const classGroupParam = url.searchParams.get("classGroupId");
    const classGroupOid = toObjectId(classGroupParam || String(note.classGroupId));

    const planQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      ownerTeacherId: context.teacherId,
      lessonNoteId: noteOid,
    };
    if (classGroupOid) {
      planQuery.classGroupId = classGroupOid;
    }

    const plan = await LessonWeekPlan.findOne(planQuery)
      .sort({ weekStartDate: -1, createdAt: -1 })
      .lean();

    if (!plan) {
      return Response.json(
        {
          success: false,
          error:
            "No weekly lessons found for this note yet. Create a week plan from your timetable first.",
        },
        { status: 404 },
      );
    }

    const sessions = await LessonSession.find({
      schoolId: context.schoolId,
      weekPlanId: plan._id,
      status: { $ne: "archived" },
    })
      .sort({ sequenceInWeek: 1 })
      .lean();

    const body: LessonWeekPreviewResponse = {
      success: true,
      data: {
        weekPlan: {
          id: String(plan._id),
          title: plan.title,
          weekLabel: plan.weekLabel,
          weekStartDate: formatDateYmdUtc(new Date(plan.weekStartDate)),
          weekEndDate: formatDateYmdUtc(new Date(plan.weekEndDate)),
          classGroupId: String(plan.classGroupId),
          lessonNoteTopic: note.topic ?? null,
        },
        sessions: sessions.map((s) => ({
          id: String(s._id),
          sequenceInWeek: s.sequenceInWeek,
          title: s.title,
          scheduledDate: formatDateYmdUtc(new Date(s.scheduledDate)),
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes,
          planNotes: s.planNotes?.trim() || null,
          contentBlocks: Array.isArray(s.contentBlocks) ? s.contentBlocks : [],
          contentVersion: s.contentVersion || 1,
        })),
      },
    };

    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-notes week-preview GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load week preview";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
