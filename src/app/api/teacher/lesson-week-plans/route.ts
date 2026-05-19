import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote } from "@/models/LessonNote";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { gateLessonsModule, isLessonNoteApprovedForDelivery } from "@/lib/lessons/lesson-gates";
import { createWeekPlanWithSessions } from "@/lib/lessons/create-week-plan";
import { formatWeekPlanDto, groupWeekPlansByWeek } from "@/lib/lessons/format-week-plan";
import type { LessonWeekPlansListResponse } from "@/types/lessons-v2";
import { resolveLessonNoteSubjectOffering } from "@/lib/lesson-notes/resolve-note-subject-offering";

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

const CreateWeekPlanSchema = z.object({
  lessonNoteId: z.string().min(1),
  classGroupId: z.string().min(1),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekLabel: z.string().trim().max(80).optional(),
  title: z.string().trim().min(1).max(220).optional(),
  sessions: z
    .array(
      z.object({
        timetableSlotId: z.string().min(1),
        timetableSlotIds: z.array(z.string().min(1)).optional(),
        title: z.string().trim().min(1).max(220),
        include: z.boolean().optional(),
        noteSectionKeys: z.array(z.string().min(1)).optional(),
        schemeItemIds: z.array(z.string().min(1)).optional(),
        coverageWeight: z.number().min(0).max(1).optional(),
        contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
      }),
    )
    .optional(),
});

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      ownerTeacherId: context.teacherId,
    };
    if (classGroupId) {
      const oid = toObjectId(classGroupId);
      if (!oid) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }
      query.classGroupId = oid;
    }

    const plans = await LessonWeekPlan.find(query).sort({ weekStartDate: -1, title: 1 }).lean();

    const planIds = plans.map((p) => p._id);
    const noteIds = [...new Set(plans.map((p) => String(p.lessonNoteId)))];

    const [sessions, deliveries, notes] = await Promise.all([
      LessonSession.find({ weekPlanId: { $in: planIds } }).lean(),
      LessonDelivery.find({ weekPlanId: { $in: planIds } }).lean(),
      noteIds.length
        ? LessonNote.find({
            _id: { $in: noteIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("_id topic")
            .lean()
        : [],
    ]);

    const topicByNote = new Map(notes.map((n) => [String(n._id), n.topic]));

    const dtos = plans.map((plan) => {
      const pid = String(plan._id);
      return formatWeekPlanDto({
        plan,
        sessions: sessions.filter((s) => String(s.weekPlanId) === pid),
        deliveries: deliveries.filter((d) => String(d.weekPlanId) === pid),
        lessonNoteTopic: topicByNote.get(String(plan.lessonNoteId)) ?? null,
      });
    });

    const body: LessonWeekPlansListResponse = {
      success: true,
      data: { weekGroups: groupWeekPlansByWeek(dtos) },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-week-plans GET]", e);
    const message = e instanceof Error ? e.message : "Failed to list week plans";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const raw = await req.json().catch(() => null);
    const parsed = CreateWeekPlanSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const noteOid = toObjectId(parsed.data.lessonNoteId);
    const classGroupOid = toObjectId(parsed.data.classGroupId);
    const weekStart = parseDateYmd(parsed.data.weekStartDate);
    const weekEnd = parseDateYmd(parsed.data.weekEndDate);
    if (!noteOid || !classGroupOid || !weekStart || !weekEnd) {
      return Response.json({ success: false, error: "Invalid IDs or dates" }, { status: 400 });
    }

    const note = await LessonNote.findOne({
      _id: noteOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id topic status subjectId subjectOfferingId academicPeriodId")
      .lean();

    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    if (!isLessonNoteApprovedForDelivery(String(note.status))) {
      return Response.json(
        {
          success: false,
          error:
            "Only approved lesson notes can be used to create weekly lessons. Submit your note for school review first.",
        },
        { status: 403 },
      );
    }

    const subjectOfferingResolution = await resolveLessonNoteSubjectOffering({
      schoolId: context.schoolId,
      classGroupId: classGroupOid,
      subjectOfferingId: note.subjectOfferingId ? String(note.subjectOfferingId) : null,
      subjectId: note.subjectId ? String(note.subjectId) : null,
    });
    if (!subjectOfferingResolution.ok) {
      return Response.json(
        { success: false, error: subjectOfferingResolution.error },
        { status: subjectOfferingResolution.status },
      );
    }
    const subjectOfferingOid = subjectOfferingResolution.subjectOfferingId;

    const existing = await LessonWeekPlan.findOne({
      schoolId: context.schoolId,
      classGroupId: classGroupOid,
      subjectOfferingId: subjectOfferingOid,
      weekStartDate: weekStart,
    })
      .select("_id")
      .lean();
    if (existing) {
      return Response.json(
        {
          success: false,
          error: "A lesson week plan already exists for this class, subject, and week.",
        },
        { status: 409 },
      );
    }

    const weekLabel = parsed.data.weekLabel?.trim() || "Week";
    const title =
      parsed.data.title?.trim() ||
      `${note.topic || "Lessons"} — ${weekLabel}`;

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
      classGroupId: classGroupOid,
      subjectOfferingId: subjectOfferingOid,
      subjectId: note.subjectId ? toObjectId(String(note.subjectId)) : null,
      lessonNoteId: note._id,
      noteTopic: note.topic || "Lesson",
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      weekLabel,
      title,
      sessionInputs: parsed.data.sessions,
    });

    if (!created.ok) {
      return Response.json({ success: false, error: created.error }, { status: created.status });
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
    console.error("[lesson-week-plans POST]", e);
    const message = e instanceof Error ? e.message : "Failed to create week plan";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
