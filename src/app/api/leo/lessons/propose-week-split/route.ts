import { z } from "zod";
import {
  findLessonNoteForTeacher,
  lessonNoteTeachingMetadata,
  lessonNoteToLeoContext,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { getAllocatableNoteSectionKeys } from "@/lib/lessons/note-sections";
import { validateCoverageWeights } from "@/lib/lessons/content-blocks";

const BodySchema = z.object({
  lessonNoteId: z.string().min(1),
  sessions: z
    .array(
      z.object({
        timetableSlotId: z.string().min(1),
        timetableSlotIds: z.array(z.string().min(1)).optional(),
        sequenceInWeek: z.number().int().min(1),
        title: z.string().trim().min(1).max(220),
        durationMinutes: z.number().int().min(1).max(240),
        scheduledDate: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        periodCount: z.number().int().min(1).max(8).optional(),
        isDoublePeriod: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(12),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const note = await findLessonNoteForTeacher(
      parsed.data.lessonNoteId,
      ctx.schoolId,
      ctx.teacherId,
    );
    if (!note) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    const sectionKeys = getAllocatableNoteSectionKeys(note);
    const payload = lessonNoteToLeoContext(note);
    const teachingMetadata = await lessonNoteTeachingMetadata(note);
    const sessionsJson = JSON.stringify(parsed.data.sessions);

    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
      "sessions": [
    {
      "timetableSlotId": string (must match input),
      "timetableSlotIds": string[] (copy input ids when present),
      "sequenceInWeek": number,
      "title": string (concise teaching session title in English),
      "noteSectionKeys": string[] (subset of allowed keys only),
      "schemeItemIds": string[] (optional, empty if unknown),
      "coverageWeight": number (0-1, all sessions must sum to 1.0),
      "focusSummary": string (one sentence describing exactly what the teacher should teach in this session)
    }
  ]
}
Allowed noteSectionKeys: ${JSON.stringify(sectionKeys)}`,
      userPrompt: `Propose a pedagogical teaching progression for this approved weekly lesson note across ${parsed.data.sessions.length} teaching sessions.

Important:
- Consecutive timetable periods may already be grouped as one double period. Treat a grouped double period as ONE longer teaching session, not two separate lessons.
- Split by what learners should understand and practise in sequence, not by mechanically assigning note sections.
- Make each focusSummary specific enough for a teacher to teach from.
- For Mathematics, sequence concrete examples before abstract rules, then guided practice, then independent checks.
- Use clear, encouraging, age-appropriate language for the implied grade.
- Do not use abusive, offensive, profane, demeaning, or discouraging wording.
- Keep the split grounded in the note. Do not invent unsupported curriculum codes.
- Coverage weights must reflect teaching time and importance and sum to 1.

Lesson note JSON:
${payload}

Teaching context:
${JSON.stringify(teachingMetadata)}

Timetable sessions:
${sessionsJson}`,
      maxTokens: 4000,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const data = result.data as { sessions?: Array<Record<string, unknown>> };
    const sessions = (data.sessions ?? []).map((row, index) => {
      const input = parsed.data.sessions[index] || parsed.data.sessions.find(
        (s) => s.timetableSlotId === row.timetableSlotId,
      );
      const keys = Array.isArray(row.noteSectionKeys)
        ? (row.noteSectionKeys as string[]).filter((k) => sectionKeys.includes(k))
        : [];
      return {
        timetableSlotId: String(row.timetableSlotId || input?.timetableSlotId || ""),
        timetableSlotIds: Array.isArray(row.timetableSlotIds)
          ? (row.timetableSlotIds as string[]).map(String)
          : input?.timetableSlotIds ?? [],
        sequenceInWeek: Number(row.sequenceInWeek || input?.sequenceInWeek || index + 1),
        title: String(row.title || input?.title || `Session ${index + 1}`).slice(0, 220),
        noteSectionKeys: keys,
        schemeItemIds: Array.isArray(row.schemeItemIds)
          ? (row.schemeItemIds as string[]).map(String)
          : [],
        coverageWeight: Number(row.coverageWeight) || 0,
        focusSummary: String(row.focusSummary || "").slice(0, 500),
      };
    });

    const weightCheck = validateCoverageWeights(sessions.map((s) => s.coverageWeight));
    if (!weightCheck.ok && sessions.length > 0) {
      const equal = 1 / sessions.length;
      for (const s of sessions) s.coverageWeight = equal;
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: { sessions },
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/propose-week-split]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
