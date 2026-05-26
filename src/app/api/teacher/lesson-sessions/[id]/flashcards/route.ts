import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonFlashcard, type ILessonFlashcard } from "@/models/LessonFlashcard";
import { getOrCreateSessionFlashcardDeck } from "@/lib/lessons/flashcard-deck-session";
import { loadSessionForFlashcardManage } from "@/lib/lessons/flashcard-access";
import { formatFlashcard, formatFlashcardDeck } from "@/lib/lessons/format-flashcards";
import type { TeacherLessonFlashcardsResponse } from "@/types/lesson-flashcards";
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const CreateCardSchema = z.object({
  front: z.string().trim().min(1).max(4000),
  back: z.string().trim().min(1).max(4000),
  hint: z.string().trim().max(2000).optional().nullable(),
  explanation: z.string().trim().max(4000).optional().nullable(),
  imageUrl: z.string().trim().url().max(2000).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().nullable(),
  cardType: z
    .enum(["qa", "term_definition", "image_prompt", "concept_example"])
    .optional()
    .nullable(),
});

const BulkCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(1).max(4000),
        back: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(
      moduleGate.settings,
      "enableFlashcards",
      "Lesson flashcards",
    );
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonFlashcardsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadSessionForFlashcardManage(
      sessionId,
      context.schoolId,
      context.teacherId,
      context.isAdmin,
    );
    if (!loaded) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const deckDoc = await getOrCreateSessionFlashcardDeck(
      context.schoolId,
      sessionId,
      context.teacherId,
    );

    const cards = (await LessonFlashcard.find({
      schoolId: context.schoolId,
      deckId: deckDoc._id,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()) as ILessonFlashcard[];

    return Response.json({
      success: true,
      data: {
        deck: formatFlashcardDeck(deckDoc),
        cards: cards.map(formatFlashcard),
      },
    } satisfies TeacherLessonFlashcardsResponse);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions flashcards GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load flashcards";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(
      moduleGate.settings,
      "enableFlashcards",
      "Lesson flashcards",
    );
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    if (!can(context.permissions, PERMISSIONS.lessonFlashcardsManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadSessionForFlashcardManage(
      sessionId,
      context.schoolId,
      context.teacherId,
      context.isAdmin,
    );
    if (!loaded) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const bulkParsed = BulkCardsSchema.safeParse(raw);
    if (bulkParsed.success) {
      const deckDoc = await getOrCreateSessionFlashcardDeck(
        context.schoolId,
        sessionId,
        context.teacherId,
      );
      const maxOrderDoc = (await LessonFlashcard.findOne({
        schoolId: context.schoolId,
        deckId: deckDoc._id,
      })
        .sort({ order: -1 })
        .select("order")
        .lean()) as { order?: number } | null;
      let nextOrder = (maxOrderDoc?.order ?? -1) + 1;
      const createdIds: string[] = [];
      for (const card of bulkParsed.data.cards) {
        const created = await LessonFlashcard.create({
          schoolId: context.schoolId,
          sessionId,
          deckId: deckDoc._id,
          front: card.front,
          back: card.back,
          difficulty: "medium",
          cardType: "qa",
          order: nextOrder++,
        });
        createdIds.push(String(created._id));
      }
      return Response.json({ success: true, data: { ids: createdIds } });
    }

    const parsed = CreateCardSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const deckDoc = await getOrCreateSessionFlashcardDeck(
      context.schoolId,
      sessionId,
      context.teacherId,
    );

    const maxOrder = (await LessonFlashcard.findOne({
      schoolId: context.schoolId,
      deckId: deckDoc._id,
    })
      .sort({ order: -1 })
      .select("order")
      .lean()) as { order?: number } | null;

    const nextOrder = (maxOrder?.order ?? -1) + 1;

    const created = await LessonFlashcard.create({
      schoolId: context.schoolId,
      sessionId,
      deckId: deckDoc._id,
      front: parsed.data.front,
      back: parsed.data.back,
      hint: parsed.data.hint?.trim() || undefined,
      explanation: parsed.data.explanation?.trim() || undefined,
      imageUrl: parsed.data.imageUrl?.trim() || undefined,
      difficulty: parsed.data.difficulty ?? "medium",
      cardType: parsed.data.cardType ?? "qa",
      order: nextOrder,
    });

    return Response.json({
      success: true,
      data: { id: String(created._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions flashcards POST]", e);
    const message = e instanceof Error ? e.message : "Failed to create flashcard";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
