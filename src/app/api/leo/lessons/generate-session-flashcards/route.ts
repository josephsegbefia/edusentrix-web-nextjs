import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { LessonSession } from "@/models/LessonSession";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  maxCards: z.number().int().min(3).max(30).optional(),
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

    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: ctx.schoolId,
      ownerTeacherId: ctx.teacherId,
    }).lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const maxCards = parsed.data.maxCards ?? 10;
    const contentSummary = blocks
      .slice(0, 12)
      .map((b) => `${b.type}: ${b.title || ""}\n${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 400)}`)
      .join("\n\n");

    const result = await runLessonsLeoCompletion({
      context: ctx,
      systemInstruction: `Return JSON only:
{
  "cards": [
    { "front": string (question or prompt), "back": string (answer or explanation) }
  ]
}
Exactly ${maxCards} items in "cards". Front and back each max ~280 characters.`,
      userPrompt: `Draft ${maxCards} revision flashcards for this taught session.
Title: ${session.title}
Plan notes: ${session.planNotes?.slice(0, 1200) || "(none)"}
Content blocks:
${contentSummary || "(no blocks yet)"}`,
      maxTokens: 3500,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: result.data,
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-flashcards]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
