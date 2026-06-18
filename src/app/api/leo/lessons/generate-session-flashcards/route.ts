import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  LESSONS_LEO_DISCLAIMER,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { loadSessionForFlashcardManage } from "@/lib/lessons/flashcard-access";
import { getOrCreateSessionFlashcardDeck } from "@/lib/lessons/flashcard-deck-session";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";
import {
  buildSessionFlashcardSystemInstruction,
  buildSessionFlashcardUserPrompt,
  dedupeFlashcardCandidates,
  parseLeoFlashcardResponse,
  type FlashcardPair,
} from "@/lib/lessons/flashcard-generation";
import { LessonFlashcard } from "@/models/LessonFlashcard";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  maxCards: z.number().int().min(1).max(30).optional(),
  slotIndex: z.number().int().min(0).max(29).optional(),
  totalSlots: z.number().int().min(1).max(30).optional(),
});

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

async function loadExistingDeckCards(
  schoolId: mongoose.Types.ObjectId,
  sessionId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId,
): Promise<FlashcardPair[]> {
  const deck = await getOrCreateSessionFlashcardDeck(schoolId, sessionId, teacherId);
  const rows = await LessonFlashcard.find({
    schoolId,
    deckId: deck._id,
  })
    .sort({ order: 1, createdAt: 1 })
    .select("front back")
    .lean<Array<{ front: string; back: string }>>();

  return rows.map((row) => ({ front: row.front, back: row.back }));
}

type TeacherCtx = Awaited<ReturnType<typeof requireTeacher>>;

async function generateSessionFlashcardsWithQuality(input: {
  ctx: TeacherCtx;
  title: string;
  planNotes: string;
  contentSummary: string;
  maxCards: number;
  existingCards: FlashcardPair[];
  slotIndex?: number;
  totalSlots?: number;
}): Promise<
  | {
      ok: true;
      cards: FlashcardPair[];
      skippedDuplicates: number;
      attempts: number;
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
    }
  | { ok: false; error: string }
> {
  const maxAttempts = input.maxCards === 1 ? 4 : 2;
  let skippedDuplicates = 0;
  let lastError = "Leo did not return usable flashcards";
  let lastUsage = {};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await runLessonsLeoCompletion({
      context: input.ctx,
      systemInstruction: buildSessionFlashcardSystemInstruction(input.maxCards),
      userPrompt: buildSessionFlashcardUserPrompt({
        title: input.title,
        planNotes: input.planNotes,
        contentSummary: input.contentSummary,
        maxCards: input.maxCards,
        existingCards: input.existingCards,
        slotIndex: input.slotIndex,
        totalSlots: input.totalSlots,
        retryAttempt: attempt > 0 ? attempt : undefined,
      }),
      maxTokens: input.maxCards === 1 ? 900 : 3500,
    });

    if (!result.ok) {
      lastError = result.error;
      continue;
    }

    lastUsage = result.usage;
    const parsed = parseLeoFlashcardResponse(result.data);
    const { unique, skipped } = dedupeFlashcardCandidates(parsed, input.existingCards);
    skippedDuplicates += skipped;

    if (unique.length >= input.maxCards) {
      return {
        ok: true,
        cards: unique.slice(0, input.maxCards),
        skippedDuplicates,
        attempts: attempt + 1,
        usage: lastUsage,
      };
    }

    if (unique.length > 0 && input.maxCards > 1) {
      return {
        ok: true,
        cards: unique,
        skippedDuplicates,
        attempts: attempt + 1,
        usage: lastUsage,
      };
    }

    if (unique.length === 1 && input.maxCards === 1) {
      return {
        ok: true,
        cards: unique,
        skippedDuplicates,
        attempts: attempt + 1,
        usage: lastUsage,
      };
    }

    lastError =
      unique.length === 0
        ? "Generated cards duplicated existing ones — retrying with a different concept."
        : lastError;
  }

  return { ok: false, error: lastError };
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
    const maxCards = parsed.data.maxCards ?? 10;

    const blocks = normalizeContentBlocks(session.contentBlocks ?? []);
    const contentSummary = blocks
      .slice(0, 12)
      .map((b) => `${b.type}: ${b.title || ""}\n${b.bodyHtml.replace(/<[^>]+>/g, " ").slice(0, 400)}`)
      .join("\n\n");

    const existingCards = await loadExistingDeckCards(
      ctx.schoolId,
      sessionOid,
      ctx.teacherId,
    );

    const generated = await generateSessionFlashcardsWithQuality({
      ctx,
      title: session.title,
      planNotes: session.planNotes?.slice(0, 1200) || "",
      contentSummary,
      maxCards,
      existingCards,
      slotIndex: parsed.data.slotIndex,
      totalSlots: parsed.data.totalSlots ?? (parsed.data.slotIndex != null ? 8 : undefined),
    });

    if (!generated.ok) {
      return Response.json({ success: false, error: generated.error }, { status: 502 });
    }

    if (generated.cards.length === 0) {
      return Response.json(
        {
          success: false,
          error:
            "Leo kept suggesting cards you already have. Add more lesson content or create cards manually.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      success: true,
      isDraft: true,
      disclaimer: LESSONS_LEO_DISCLAIMER,
      data: {
        cards: generated.cards,
        meta: {
          skippedDuplicates: generated.skippedDuplicates,
          attempts: generated.attempts,
          existingCount: existingCards.length,
        },
      },
      usage: generated.usage,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-session-flashcards]", e);
    const message = e instanceof Error ? e.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
