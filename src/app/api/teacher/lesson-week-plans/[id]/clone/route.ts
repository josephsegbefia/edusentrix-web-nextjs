import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { gateLessonsModule, isLessonNoteApprovedForDelivery } from "@/lib/lessons/lesson-gates";
import { createWeekPlanWithSessions } from "@/lib/lessons/create-week-plan";
import { formatWeekPlanDto } from "@/lib/lessons/format-week-plan";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CloneSchema = z.object({
  targetClassGroupId: z.string().min(1),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(
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
    if (!can(context.permissions, PERMISSIONS.lessonsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sourcePlanOid = toObjectId(id);
    if (!sourcePlanOid) {
      return Response.json({ success: false, error: "Invalid week plan ID" }, { status: 400 });
    }

    const sourcePlan = await LessonWeekPlan.findOne({
      _id: sourcePlanOid,
      schoolId: context.schoolId,
      ownerTeacherId: context.teacherId,
    }).lean();

    if (!sourcePlan) {
      return Response.json({ success: false, error: "Source week plan not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = CloneSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const targetClassOid = toObjectId(parsed.data.targetClassGroupId);
    if (!targetClassOid) {
      return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
    }

    if (String(targetClassOid) === String(sourcePlan.classGroupId)) {
      return Response.json(
        { success: false, error: "Choose a different class group to clone into." },
        { status: 400 },
      );
    }

    const weekStart = parsed.data.weekStartDate
      ? parseDateYmd(parsed.data.weekStartDate)
      : new Date(sourcePlan.weekStartDate);
    const weekEnd = parsed.data.weekEndDate
      ? parseDateYmd(parsed.data.weekEndDate)
      : new Date(sourcePlan.weekEndDate);
    if (!weekStart || !weekEnd) {
      return Response.json({ success: false, error: "Invalid week dates" }, { status: 400 });
    }

    const note = await LessonNote.findOne({
      _id: sourcePlan.lessonNoteId,
      schoolId: context.schoolId,
    })
      .select("_id topic status academicPeriodId subjectOfferingId")
      .lean();

    if (!note || !isLessonNoteApprovedForDelivery(String(note.status))) {
      return Response.json(
        { success: false, error: "Lesson note must be approved to clone a week plan." },
        { status: 403 },
      );
    }

    const existing = await LessonWeekPlan.findOne({
      schoolId: context.schoolId,
      classGroupId: targetClassOid,
      subjectOfferingId: sourcePlan.subjectOfferingId,
      weekStartDate: weekStart,
    })
      .select("_id")
      .lean();
    if (existing) {
      return Response.json(
        {
          success: false,
          error: "A week plan already exists for that class, subject, and week.",
        },
        { status: 409 },
      );
    }

    const sourceSessions = await LessonSession.find({ weekPlanId: sourcePlan._id })
      .sort({ sequenceInWeek: 1 })
      .lean();

    const { listTimetableSlotsForClassSubjectWeek } = await import(
      "@/lib/lessons/timetable-slots-for-week"
    );
    const targetTimetable = await listTimetableSlotsForClassSubjectWeek({
      schoolId: context.schoolId,
      classGroupId: targetClassOid,
      subjectOfferingId: sourcePlan.subjectOfferingId as mongoose.Types.ObjectId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      teacherId: context.teacherId,
    });

    if (!targetTimetable.hasPublishedTimetable) {
      return Response.json(
        {
          success: false,
          error: "Target class has no published timetable for this subject and week.",
        },
        { status: 400 },
      );
    }

    const matchSlot = (day: number, start: string) =>
      targetTimetable.slots.find((s) => s.dayOfWeek === day && s.startTime === start);

    const sessionInputs = sourceSessions
      .map((src) => {
        const match = matchSlot(src.dayOfWeek, src.startTime);
        if (!match) return null;
        return {
          timetableSlotId: match.id,
          title: src.title,
          include: true,
        };
      })
      .filter((row): row is { timetableSlotId: string; title: string; include: boolean } =>
        Boolean(row),
      );

    if (sessionInputs.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "Could not match any timetable periods between the source and target class for this week.",
        },
        { status: 400 },
      );
    }

    const academicPeriodId = note.academicPeriodId
      ? toObjectId(String(note.academicPeriodId))
      : null;
    if (!academicPeriodId) {
      return Response.json(
        { success: false, error: "Lesson note is missing an academic period" },
        { status: 400 },
      );
    }

    const created = await createWeekPlanWithSessions({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId,
      classGroupId: targetClassOid,
      subjectOfferingId: sourcePlan.subjectOfferingId as mongoose.Types.ObjectId,
      lessonNoteId: sourcePlan.lessonNoteId as mongoose.Types.ObjectId,
      noteTopic: note.topic || "Lesson",
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      weekLabel: sourcePlan.weekLabel,
      title: sourcePlan.title,
      sessionInputs,
      clonedFromWeekPlanId: sourcePlan._id as mongoose.Types.ObjectId,
    });

    if (!created.ok) {
      return Response.json({ success: false, error: created.error }, { status: created.status });
    }

    for (let i = 0; i < created.sessions.length && i < sourceSessions.length; i += 1) {
      const src = sourceSessions[i];
      const dest = created.sessions[i];
      if (!src || !dest) continue;
      if (src.planNotes) dest.planNotes = src.planNotes;
      if (src.contentBlocks?.length) {
        dest.contentBlocks = src.contentBlocks;
        dest.aiMetadata = src.aiMetadata;
      }
      if (src.noteSectionAllocation) {
        dest.noteSectionAllocation = src.noteSectionAllocation;
      }
      await dest.save();
    }

    const dto = formatWeekPlanDto({
      plan: created.plan.toObject(),
      sessions: created.sessions.map((s) => s.toObject()),
      deliveries: created.deliveries.map((d) => d.toObject()),
      lessonNoteTopic: note.topic,
    });

    return Response.json({ success: true, data: { weekPlan: dto } }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-week-plans clone]", e);
    const message = e instanceof Error ? e.message : "Failed to clone week plan";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
