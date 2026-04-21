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

const BodySchema = z.object({
  academicPeriodId: z.string().length(24),
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
        { success: false, error: "academicPeriodId is required." },
        { status: 400 }
      );
    }
    const { academicPeriodId } = parsedBody.data;
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
    const slotLines = slots.map((s) => {
      const d = dayNames[s.dayOfWeek] ?? s.dayOfWeek;
      const tid = toValidOidString(s.teacherId);
      const tLabel = tid ? teacherName(tid) : "Unassigned";
      return `- ${d} ${s.startTime}-${s.endTime}: ${subName(String(s.subjectId))} with ${tLabel}`;
    });

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
      const fallback =
        slotLines.length === 0
          ? "Add lessons by dragging subject+teacher into period rows. Ensure Settings → school periods and breaks match how you want the day structured."
          : `You have ${slotLines.length} lesson(s) in this draft. ${
              conflicts.length
                ? `There are ${conflicts.length} open conflict(s) — often a teacher double-booked across classes; adjust times or teachers.`
                : "No conflicts flagged for this class's slots in the current draft."
            }`;
      return NextResponse.json({ success: true, data: { text: fallback } });
    }

    const gradeName =
      (cg as { gradeId?: { name?: string } | null }).gradeId &&
      typeof (cg as { gradeId?: { name?: string } }).gradeId === "object"
        ? String((cg as { gradeId: { name?: string } }).gradeId.name || "")
        : "";

    const prompt = `You are Leo, a concise school timetable assistant. The administrator is editing the class "${gradeName} ${(cg as { name?: string }).name || ""}" draft.

Lessons in this class draft:
${slotLines.length ? slotLines.join("\n") : "(none yet)"}

Open conflicts touching these lessons:
${conflicts.length ? conflicts.map((c) => `- ${(c as { code?: string }).code}: ${(c as { message?: string }).message}`).join("\n") : "(none)"}

Give 3–6 short bullet suggestions (plain text, no markdown headings). Focus on feasibility: teacher clashes, empty periods, break placement, and encouraging alignment with the school's bell schedule.`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TIMETABLE_COACH_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You help school staff build conflict-aware timetables. Be practical and brief." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 450,
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
