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
  count: z.number().int().min(1).max(6).default(3),
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
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
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
    const contentSummary = blocks
      .slice(0, 12)
      .map(
        (b) =>
          `${b.type}: ${b.title || ""}\n${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 500)}`,
      )
      .join("\n\n");

    const count = parsed.data.count;

    const result = await runLessonsLeoCompletion({
      context: ctx,
      model: "gpt-4o",
      systemInstruction: `Return JSON only:
{
  "factCards": [
    {
      "fact": string (one short, curiosity-provoking sentence — the "hook"),
      "detail": string (2-3 sentences explaining the fact or its real-world relevance),
      "tags": string[] (1-3 subject/topic tags)
    }
  ]
}
Rules:
- Produce exactly ${count} fact cards.
- Each "fact" must be grounded in the session content — do not invent unrelated trivia.
- Write for the learner's grade level — interesting, accessible, and encouraging curiosity.
- The "fact" should spark a "wow, I didn't know that!" reaction — connect the topic to the real world, history, nature, technology, or everyday life in Ghana.
- The "detail" should explain why the fact is true or interesting — 2-3 short sentences.
- Do not repeat facts across cards.
- Use safe, encouraging, age-appropriate language. No abusive, frightening, or discouraging wording.`,
      userPrompt: `Generate ${count} "Did You Know" curiosity fact cards for learners based on this lesson session.

Session title: ${session.title}
Subject: ${session.subjectNameSnapshot ?? "unknown subject"}

Session content summary:
${contentSummary || "(no content blocks yet — use the session title and subject as context)"}`,
      maxTokens: 2500,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const data = result.data as { factCards?: unknown[] };
    const rawCards = Array.isArray(data.factCards) ? data.factCards : [];

    const factCards = rawCards
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c, i) => ({
        fact: String(c.fact || `Fact ${i + 1}`).slice(0, 500),
        detail: String(c.detail || "").slice(0, 2000),
        tags: Array.isArray(c.tags) ? (c.tags as unknown[]).map((t) => String(t)).slice(0, 3) : [],
      }));

    if (factCards.length === 0) {
      return Response.json(
        { success: false, error: "Leo did not return any fact cards. Try again." },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: { factCards },
      usage: result.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-fact-cards]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
