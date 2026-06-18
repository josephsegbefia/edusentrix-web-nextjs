import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { loadSessionForFlashcardManage } from "@/lib/lessons/flashcard-access";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import {
  buildFactCardSystemInstruction,
  buildFactCardUserPrompt,
  dedupeFactCardCandidates,
  parseLeoFactCardResponse,
} from "@/lib/lessons/fact-card-generation";
import { LearnFactCard } from "@/models/LearnFactCard";

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

    const loaded = await loadSessionForFlashcardManage(
      sessionOid,
      ctx.schoolId,
      ctx.teacherId,
      ctx.isAdmin,
    );

    if (!loaded) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const { session } = loaded;
    const count = parsed.data.count;

    const existingRows = await LearnFactCard.find({
      schoolId: ctx.schoolId,
      sessionId: sessionOid,
    })
      .select("fact detail")
      .lean<Array<{ fact: string; detail: string }>>();

    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const contentSummary = blocks
      .slice(0, 12)
      .map(
        (b) =>
          `${b.type}: ${b.title || ""}\n${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 500)}`,
      )
      .join("\n\n");

    let factCards: ReturnType<typeof dedupeFactCardCandidates>["unique"] = [];
    let skippedDuplicates = 0;
    let attempts = 0;
    let lastError = "Leo did not return usable fact cards";
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } = {};

    for (let attempt = 0; attempt < 3; attempt++) {
      attempts = attempt + 1;
      const result = await runLessonsLeoCompletion({
        context: ctx,
        systemInstruction: buildFactCardSystemInstruction(count),
        userPrompt: buildFactCardUserPrompt({
          title: session.title,
          subjectName: session.subjectNameSnapshot ?? "unknown subject",
          contentSummary,
          count,
          existingCards: existingRows,
          retryAttempt: attempt > 0 ? attempt : undefined,
        }),
        maxTokens: 2500,
      });

      if (!result.ok) {
        lastError = result.error;
        continue;
      }

      usage = result.usage;
      const parsedCards = parseLeoFactCardResponse(result.data);
      const deduped = dedupeFactCardCandidates(parsedCards, existingRows);
      skippedDuplicates += deduped.skipped;

      if (deduped.unique.length >= count) {
        factCards = deduped.unique.slice(0, count);
        break;
      }
      if (deduped.unique.length > 0) {
        factCards = deduped.unique;
        break;
      }
      lastError = "Generated facts repeated cards already in this session.";
    }

    if (factCards.length === 0) {
      return Response.json({ success: false, error: lastError }, { status: 502 });
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: {
        factCards,
        meta: { skippedDuplicates, attempts, existingCount: existingRows.length },
      },
      usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-fact-cards]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
