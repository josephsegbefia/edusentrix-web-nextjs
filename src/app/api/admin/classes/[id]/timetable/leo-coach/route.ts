import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireClassTimetableEditor } from "@/lib/auth/requireClassTimetableEditor";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TimetableConflict } from "@/models/TimetableConflict";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { User } from "@/models/User";
import { hhmmToMinutes } from "@/lib/school-day/time";

const GapSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(4).max(5),
  endTime: z.string().min(4).max(5),
  /** What's scheduled immediately before this gap (from the day strip). */
  beforeBlock: z.string().max(300).optional(),
  /** What's scheduled immediately after this gap. */
  afterBlock: z.string().max(300).optional(),
  /** e.g. "Monday, mid-morning" */
  timeOfDayContext: z.string().max(200).optional(),
});

const BodySchema = z.object({
  academicPeriodId: z.string().length(24),
  /** Focus Leo on a specific unallocated (slack) window in the class day view. */
  gap: GapSchema.optional(),
});

function toOid(s: string) {
  try {
    return new mongoose.Types.ObjectId(s);
  } catch {
    return null;
  }
}

/** Only 24-char hex ids; skips null/undefined optional refs (e.g. unassigned teacher). */
function toValidOidString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return String(new mongoose.Types.ObjectId(s)) === s ? s : null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await ctx.params;
    await requireClassTimetableEditor(classId);

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: "academicPeriodId is required (and optional gap must be valid)." },
        { status: 400 }
      );
    }
    const { academicPeriodId, gap } = parsedBody.data;
    const apObjId = toOid(academicPeriodId);
    const classObjId = toOid(classId);
    if (!apObjId || !classObjId) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }

    await connectToDatabase();

    const cg = await ClassGroup.findById(classObjId)
      .select("name gradeId")
      .populate("gradeId", "name")
      .lean();
    if (!cg) {
      return NextResponse.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    const version = await TimetableVersion.findOne({
      academicPeriodId: apObjId,
      status: "draft",
    })
      .sort({ updatedAt: -1 })
      .select("_id")
      .lean();

    if (!version) {
      return NextResponse.json({
        success: true,
        data: {
          text: "No draft timetable yet. Add your first lesson from the period grid; a draft version will be created automatically.",
        },
      });
    }

    const versionId = (version as { _id: mongoose.Types.ObjectId })._id;

    const slots = await TimetableSlot.find({
      versionId,
      classGroupId: classObjId,
    })
      .select("dayOfWeek startTime endTime subjectId teacherId")
      .lean();

    const subjectIds = [
      ...new Set(
        slots.map((s) => toValidOidString(s.subjectId)).filter((x): x is string => x !== null)
      ),
    ];
    const teacherIds = [
      ...new Set(
        slots.map((s) => toValidOidString(s.teacherId)).filter((x): x is string => x !== null)
      ),
    ];

    const [subjects, teachers] = await Promise.all([
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds.map((x) => new mongoose.Types.ObjectId(x)) } })
            .select("name")
            .lean()
        : [],
      teacherIds.length
        ? Teacher.find({ _id: { $in: teacherIds.map((x) => new mongoose.Types.ObjectId(x)) } })
            .select("userId")
            .lean()
        : [],
    ]);

    const userIds = teachers
      .map((t) => (t as { userId?: mongoose.Types.ObjectId }).userId)
      .filter(Boolean) as mongoose.Types.ObjectId[];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select("firstName lastName")
          .lean()
      : [];

    const teacherName = (tid: string) => {
      if (!tid || !mongoose.Types.ObjectId.isValid(tid)) return "Unassigned";
      const te = teachers.find((x) => String((x as { _id: mongoose.Types.ObjectId })._id) === tid) as
        | { userId?: mongoose.Types.ObjectId }
        | undefined;
      if (!te?.userId) return "Unassigned";
      const u = users.find((x) => String((x as { _id: mongoose.Types.ObjectId })._id) === String(te.userId)) as
        | { firstName?: string; lastName?: string }
        | undefined;
      if (!u) return tid;
      return `${u.firstName || ""} ${u.lastName || ""}`.trim() || tid;
    };

    const subName = (sid: string) => {
      const s = subjects.find((x) => String((x as { _id: mongoose.Types.ObjectId })._id) === sid) as
        | { name?: string }
        | undefined;
      return s?.name || sid;
    };

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const slotLine = (s: (typeof slots)[0]) => {
      const d = dayNames[s.dayOfWeek] ?? s.dayOfWeek;
      const tid = toValidOidString(s.teacherId);
      const tLabel = tid ? teacherName(tid) : "Unassigned";
      return `- ${d} ${s.startTime}-${s.endTime}: ${subName(String(s.subjectId))} with ${tLabel}`;
    };
    const slotLines = slots.map(slotLine);
    const slotsThisDay = gap
      ? slots.filter((s) => s.dayOfWeek === gap.dayOfWeek)
      : slots;
    const slotLinesThisDay = slotsThisDay.map(slotLine);

    const slotIds = slots.map((s) => s._id);

    const conflicts = await TimetableConflict.find({
      versionId,
      status: "open",
      slotIds: { $in: slotIds },
    })
      .select("code message")
      .limit(25)
      .lean();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      let fallback: string;
      if (gap) {
        const gDay = dayNames[gap.dayOfWeek] ?? gap.dayOfWeek;
        const a = hhmmToMinutes(gap.startTime);
        const b = hhmmToMinutes(gap.endTime);
        const gapMin = a != null && b != null && b > a ? b - a : 0;
        const beforeL = gap.beforeBlock || "the start of the teaching window";
        const afterL = gap.afterBlock || "the end of the teaching day";
        fallback =
          slotLinesThisDay.length === 0
            ? `On ${gDay} (${gap.timeOfDayContext || "this time"}), the ${gapMin || "?"}-minute unallocated block between ${beforeL} and ${afterL} is well suited to staff planning or a fixed pastoral slot until you add lessons.`
            : `On ${gDay}, between ${beforeL} and ${afterL}, this ${gapMin || "?"}-minute unallocated window fits a single purpose such as a short club or intervention block alongside your ${slotLinesThisDay.length} timetabled lesson(s) that day, without moving formal periods.`;
      } else {
        fallback =
          slotLines.length === 0
            ? "Add lessons by dragging subject+teacher into period rows. Ensure Settings → school periods and breaks match how you want the day structured."
            : `You have ${slotLines.length} lesson(s) in this draft. ${
                conflicts.length
                  ? `There are ${conflicts.length} open conflict(s) — often a teacher double-booked across classes; adjust times or teachers.`
                  : "No conflicts flagged for this class's slots in the current draft."
              }`;
      }
      return NextResponse.json({ success: true, data: { text: fallback } });
    }

    const gradeName =
      (cg as { gradeId?: { name?: string } | null }).gradeId &&
      typeof (cg as { gradeId?: { name?: string } }).gradeId === "object"
        ? String((cg as { gradeId: { name?: string } }).gradeId.name || "")
        : "";

    const classLabel = `${gradeName} ${(cg as { name?: string }).name || ""}`.trim();

    const baseBlock = `Lessons in this class draft (all week):
${slotLines.length ? slotLines.join("\n") : "(none yet)"}

Open conflicts touching these lessons:
${conflicts.length ? conflicts.map((c) => `- ${(c as { code?: string }).code}: ${(c as { message?: string }).message}`).join("\n") : "(none)"}`;

    const gapMins = gap
      ? (() => {
          const x = hhmmToMinutes(gap.startTime);
          const y = hhmmToMinutes(gap.endTime);
          return x != null && y != null && y > x ? y - x : 0;
        })()
      : 0;
    const dayLabel = gap ? (dayNames[gap.dayOfWeek] ?? "Day") : "";
    const beforeL = gap?.beforeBlock || "start of the teaching day window";
    const afterL = gap?.afterBlock || "end of the teaching day";
    const tdc = gap?.timeOfDayContext || "";

    const prompt = gap
      ? `You are Leo, a school timetable assistant. The class is "${classLabel}".

The user is asking about ONE unallocated (slack) window in the school day template. This is NOT a cell where you assign subjects in the class grid; it is extra time in the day structure.

Facts:
- Day of week: ${dayLabel} (${tdc || "time-of-day not specified"}).
- Unallocated: ${gap.startTime} to ${gap.endTime} (about ${gapMins} minutes if positive).
- Immediately BEFORE this unallocated time in the day strip: ${beforeL}
- Immediately AFTER: ${afterL}

This class's scheduled lessons on ${dayLabel} in the draft:
${slotLinesThisDay.length ? slotLinesThisDay.join("\n") : "(none on that day yet)"}

Full-week draft and conflicts (for light context only):
${baseBlock}

Reply with EXACTLY ONE short paragraph (2–4 sentences). Give a single, reasonable recommendation for what this school is most likely to do with this specific gap, using the time of day, weekday, and what comes before/after. Do not use bullet points. Do not suggest dropping a subject into this block in the class timetable.`
      : `You are Leo, a concise school timetable assistant. The administrator is editing the class "${classLabel}" draft.

${baseBlock}

Give 3–6 short bullet suggestions (plain text, no markdown headings). Focus on feasibility: teacher clashes, empty periods, break placement, and encouraging alignment with the school's bell schedule.`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TIMETABLE_COACH_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: gap
            ? "You give one practical paragraph only. No bullets, no list."
            : "You help school staff build conflict-aware timetables. Be practical and brief.",
        },
        { role: "user", content: prompt },
      ],
      temperature: gap ? 0.35 : 0.4,
      max_tokens: gap ? 220 : 450,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      success: true,
      data: { text: text || "Try adding a few core subjects first, then fill gaps." },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("leo-coach timetable error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Leo coach failed" },
      { status: 500 }
    );
  }
}
