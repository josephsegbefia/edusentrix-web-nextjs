import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  findLessonNoteForTeacher,
  lessonNoteToLeoContext,
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { LessonSession } from "@/models/LessonSession";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import { leoPracticeQuestionsToHomeworkSeed } from "@/lib/lessons/leo-practice-to-homework";
import { requireSessionPostCompleteForTeacher } from "@/lib/lessons/require-session-post-complete";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  questionCount: z.number().int().min(3).max(20).optional(),
});

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    await connectToDatabase();

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const sessionOid = toObjectId(parsed.data.sessionId);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const access = await requireSessionPostCompleteForTeacher({
      sessionId: sessionOid,
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
      isAdmin: ctx.isAdmin,
      requireManageContent: true,
    });
    if ("error" in access) return access.error;

    const session = access.session;
    const note = await findLessonNoteForTeacher(
      String(session.lessonNoteId),
      ctx.schoolId,
      ctx.teacherId,
    );

    const n = parsed.data.questionCount ?? 8;
    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const blockSummary = blocks
      .map((b) => `${b.type}: ${(b.title || "").trim()} ${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 300)}`)
      .join("\n");

    const notePayload = note ? lessonNoteToLeoContext(note) : "{}";
    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "questions": [
    {
      "question": string,
      "type": "multiple-choice" | "short-answer",
      "options": string[] | null,
      "answer": string
    }
  ]
}
Exactly ${n} items. Prefer multiple-choice with 4 options when possible.`,
      userPrompt: `Draft classroom practice / exercise questions for this taught session.
Session title: ${session.title}
Plan notes: ${session.planNotes?.slice(0, 1500) || "(none)"}
Session content blocks:
${blockSummary || "(none)"}
Lesson note JSON:
${notePayload}`,
      maxTokens: 4000,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const questions = leoPracticeQuestionsToHomeworkSeed(result.data, n);

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: { questions, raw: result.data },
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-practice]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
