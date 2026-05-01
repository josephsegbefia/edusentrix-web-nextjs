import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson, type ILessonPublishedSnapshot } from "@/models/Lesson";
import { LessonFlashcard } from "@/models/LessonFlashcard";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function printableSnippet(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeSeedFromSnapshot(
  lesson: Pick<ILesson, "_id" | "title" | "subjectId" | "classGroupId" | "publishedSnapshot">,
  type: "assignment" | "quiz",
  questionSeedSource: "none" | "flashcards" | "assessment",
  seededQuestions: Array<{
    id: string;
    prompt: string;
    points: number;
    explanation?: string | null;
    choices: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>
) {
  const snap = lesson.publishedSnapshot as ILessonPublishedSnapshot | null;
  const topic = snap?.topic || lesson.title || "Lesson";
  const bodyText = printableSnippet(snap?.body);
  const assessmentText = printableSnippet(snap?.assessment);

  const merged = [bodyText, assessmentText].filter(Boolean).join("\n\n");
  const instructions =
    merged.length > 0
      ? `Based on lesson: ${topic}\n\n${merged}`.slice(0, 8000)
      : `Based on lesson: ${topic}`;

  return {
    lessonId: String(lesson._id),
    lessonTitle: lesson.title,
    title:
      type === "quiz"
        ? `${topic} Quiz`.slice(0, 160)
        : `${topic} Assignment`.slice(0, 160),
    instructions,
    type,
    subjectId: lesson.subjectId ? String(lesson.subjectId) : null,
    classGroupIds: [String(lesson.classGroupId)],
    maxScore: 100,
    ...(type === "quiz"
      ? { questions: seededQuestions, questionSeedSource }
      : {}),
  };
}

function deriveQuestionsFromLessonSnapshot(
  snapshot: ILessonPublishedSnapshot | null
): Array<{
  id: string;
  prompt: string;
  points: number;
  explanation?: string | null;
  choices: Array<{ id: string; text: string; isCorrect: boolean }>;
}> {
  if (!snapshot || !snapshot.assessment || typeof snapshot.assessment !== "object") return [];
  const possible =
    (snapshot.assessment as { questions?: unknown; practiceQuestions?: unknown }).questions ??
    (snapshot.assessment as { questions?: unknown; practiceQuestions?: unknown }).practiceQuestions;
  if (!Array.isArray(possible)) return [];

  return possible
    .map((q, idx) => {
      if (!q || typeof q !== "object") return null;
      const item = q as {
        question?: unknown;
        prompt?: unknown;
        choices?: unknown;
        options?: unknown;
        answer?: unknown;
        correctAnswer?: unknown;
      };
      const prompt = typeof item.prompt === "string" ? item.prompt : typeof item.question === "string" ? item.question : "";
      const optionsRaw = Array.isArray(item.choices) ? item.choices : Array.isArray(item.options) ? item.options : [];
      const options = optionsRaw
        .map((opt) => (typeof opt === "string" ? opt.trim() : ""))
        .filter(Boolean)
        .slice(0, 4);
      if (!prompt.trim() || options.length < 2) return null;
      const answerText =
        typeof item.correctAnswer === "string"
          ? item.correctAnswer
          : typeof item.answer === "string"
            ? item.answer
            : options[0];
      return {
        id: `seed_assessment_${idx + 1}`,
        prompt: prompt.trim(),
        points: 1,
        explanation: null,
        choices: options.map((text, optionIdx) => ({
          id: `seed_assessment_${idx + 1}_choice_${optionIdx + 1}`,
          text,
          isCorrect: text.toLowerCase() === answerText.toLowerCase(),
        })),
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .slice(0, 8);
}

function deriveQuestionsFromFlashcards(
  cards: Array<{ _id: mongoose.Types.ObjectId; front: string; back: string }>
): Array<{
  id: string;
  prompt: string;
  points: number;
  explanation?: string | null;
  choices: Array<{ id: string; text: string; isCorrect: boolean }>;
}> {
  return cards
    .map((card, idx) => {
      const prompt = card.front?.trim();
      const answer = card.back?.trim();
      if (!prompt || !answer) return null;
      const distractors = cards
        .filter((other) => String(other._id) !== String(card._id))
        .map((other) => other.back?.trim() || "")
        .filter(Boolean)
        .filter((text) => text.toLowerCase() !== answer.toLowerCase())
        .slice(0, 3);
      const options = [answer, ...distractors]
        .filter((value, position, arr) => arr.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === position)
        .slice(0, 4);
      if (options.length < 2) return null;
      return {
        id: `seed_flashcard_${idx + 1}`,
        prompt,
        points: 1,
        explanation: null,
        choices: options.map((text, optionIdx) => ({
          id: `seed_flashcard_${idx + 1}_choice_${optionIdx + 1}`,
          text,
          isCorrect: text.toLowerCase() === answer.toLowerCase(),
        })),
      };
    })
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .slice(0, 8);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.assignmentsCreate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const typeParam = new URL(req.url).searchParams.get("type");
    const type = typeParam === "quiz" ? "quiz" : "assignment";

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = (await Lesson.findOne({
      _id: lessonId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id title subjectId classGroupId publishedSnapshot")
      .lean()) as Pick<
      ILesson,
      "_id" | "title" | "subjectId" | "classGroupId" | "publishedSnapshot"
    > | null;

    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const snapshot = (lesson.publishedSnapshot as ILessonPublishedSnapshot | null) ?? null;
    const quizSeed =
      type === "quiz"
        ? (() => {
            const cards = (LessonFlashcard.find({
              schoolId: context.schoolId,
              lessonId: lesson._id,
            })
              .sort({ order: 1, createdAt: 1 })
              .limit(12)
              .select("_id front back")
              .lean()) as Promise<Array<{ _id: mongoose.Types.ObjectId; front: string; back: string }>>;
            return cards.then((rows) => {
              const fromCards = deriveQuestionsFromFlashcards(rows);
              if (fromCards.length > 0) {
                return {
                  questions: fromCards,
                  source: "flashcards" as const,
                };
              }
              const fromAssessment = deriveQuestionsFromLessonSnapshot(snapshot);
              if (fromAssessment.length > 0) {
                return {
                  questions: fromAssessment,
                  source: "assessment" as const,
                };
              }
              return { questions: [], source: "none" as const };
            });
          })()
        : Promise.resolve({ questions: [], source: "none" as const });

    const resolvedQuizSeed = await quizSeed;
    const seed = normalizeSeedFromSnapshot(
      lesson,
      type,
      resolvedQuizSeed.source,
      resolvedQuizSeed.questions
    );
    if (!seed.subjectId) {
      return Response.json(
        { success: false, error: "Lesson does not have a subject; cannot prefill assignment." },
        { status: 400 }
      );
    }

    return Response.json({ success: true, data: seed });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to build lesson assignment seed:", e);
    const message = e instanceof Error ? e.message : "Failed to build assignment seed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
