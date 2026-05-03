import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { Lesson, type ILesson } from "@/models/Lesson";
import { Subject } from "@/models/Subject";
import { StudentLessonProgress } from "@/models/StudentLessonProgress";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { StudentFlashcardProgress } from "@/models/StudentFlashcardProgress";
import { completionRatioPercent } from "@/lib/lessons/completion-percent";
import { assertLessonsFeatureEnabled, assertLessonsModuleEnabled } from "@/lib/lessons/settings";

function parsePagination(searchParams: URLSearchParams): { limit: number; offset: number } {
  const limitRaw = searchParams.get("limit");
  const offsetRaw = searchParams.get("offset");
  const limit = limitRaw ? Math.min(Math.max(Math.floor(Number(limitRaw)), 1), 50) : 30;
  const offset = offsetRaw ? Math.max(Math.floor(Number(offsetRaw)), 0) : 0;
  return { limit, offset };
}

function startOfDay(d: Date) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function computeRecentCompletionStreakDays(
  completionDays: string[],
  now: Date
): number {
  if (completionDays.length === 0) return 0;
  const uniqueSorted = [...new Set(completionDays)].sort((a, b) => (a < b ? 1 : -1));
  const today = startOfDay(now);
  const latest = startOfDay(new Date(`${uniqueSorted[0]}T00:00:00.000Z`));
  const diffDaysFromToday = Math.floor((today.getTime() - latest.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDaysFromToday > 1) return 0;

  let streak = 0;
  let cursor = latest;
  for (const day of uniqueSorted) {
    const current = startOfDay(new Date(`${day}T00:00:00.000Z`));
    if (current.getTime() !== cursor.getTime()) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export async function GET(req: Request) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const moduleGate = await assertLessonsModuleEnabled(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const featureGate = assertLessonsFeatureEnabled(moduleGate.settings, "enableStudentLessonView", "Student lesson view");
    if (!featureGate.ok) {
      return Response.json({ success: false, error: featureGate.error }, { status: featureGate.status });
    }

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const { limit, offset } = parsePagination(new URL(req.url).searchParams);

    const classLessonMatch = {
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "published" as const,
    };

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      publishedLessonsTotal,
      entries,
      studiedAgg,
      flashcardStatusAgg,
      flashcardReviewAgg,
      completionDaysAgg,
      completionsInLast7d,
    ] = await Promise.all([
      Lesson.countDocuments(classLessonMatch),
      Lesson.find(classLessonMatch)
        .sort({ publishedAt: -1, updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean<ILesson[]>(),
      StudentLessonProgress.aggregate<{ c?: number }>([
        {
          $match: {
            schoolId: context.schoolId,
            studentId: student._id,
            completionStatus: "completed",
          },
        },
        {
          $lookup: {
            from: Lesson.collection.name,
            localField: "lessonId",
            foreignField: "_id",
            as: "lesson",
            pipeline: [
              {
                $match: {
                  schoolId: context.schoolId,
                  classGroupId: student.classGroupId,
                  status: "published",
                },
              },
              { $project: { _id: 1 } },
            ],
          },
        },
        { $match: { "lesson.0": { $exists: true } } },
        { $count: "c" },
      ]),
      StudentFlashcardProgress.aggregate<{ _id: string; n: number }>([
        {
          $match: {
            schoolId: context.schoolId,
            studentId: student._id,
          },
        },
        {
          $lookup: {
            from: LessonFlashcardDeck.collection.name,
            localField: "deckId",
            foreignField: "_id",
            as: "deck",
            pipeline: [{ $project: { _id: 1, lessonId: 1, schoolId: 1 } }],
          },
        },
        { $unwind: "$deck" },
        {
          $lookup: {
            from: Lesson.collection.name,
            localField: "deck.lessonId",
            foreignField: "_id",
            as: "lesson",
            pipeline: [
              {
                $match: {
                  schoolId: context.schoolId,
                  classGroupId: student.classGroupId,
                  status: "published",
                },
              },
              { $project: { _id: 1 } },
            ],
          },
        },
        { $match: { "lesson.0": { $exists: true } } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      StudentFlashcardProgress.aggregate<{ reviewedCards: number; reviewEvents: number }>([
        {
          $match: {
            schoolId: context.schoolId,
            studentId: student._id,
            reviewCount: { $gt: 0 },
          },
        },
        {
          $lookup: {
            from: LessonFlashcardDeck.collection.name,
            localField: "deckId",
            foreignField: "_id",
            as: "deck",
            pipeline: [{ $project: { _id: 1, lessonId: 1, schoolId: 1 } }],
          },
        },
        { $unwind: "$deck" },
        {
          $lookup: {
            from: Lesson.collection.name,
            localField: "deck.lessonId",
            foreignField: "_id",
            as: "lesson",
            pipeline: [
              {
                $match: {
                  schoolId: context.schoolId,
                  classGroupId: student.classGroupId,
                  status: "published",
                },
              },
              { $project: { _id: 1 } },
            ],
          },
        },
        { $match: { "lesson.0": { $exists: true } } },
        {
          $group: {
            _id: null,
            reviewedCards: { $sum: 1 },
            reviewEvents: { $sum: "$reviewCount" },
          },
        },
        { $project: { _id: 0, reviewedCards: 1, reviewEvents: 1 } },
      ]),
      StudentLessonProgress.aggregate<{ _id: string }>([
        {
          $match: {
            schoolId: context.schoolId,
            studentId: student._id,
            completionStatus: "completed",
            completedAt: { $type: "date" },
          },
        },
        {
          $lookup: {
            from: Lesson.collection.name,
            localField: "lessonId",
            foreignField: "_id",
            as: "lesson",
            pipeline: [
              {
                $match: {
                  schoolId: context.schoolId,
                  classGroupId: student.classGroupId,
                  status: "published",
                },
              },
              { $project: { _id: 1 } },
            ],
          },
        },
        { $match: { "lesson.0": { $exists: true } } },
        {
          $project: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          },
        },
        { $group: { _id: "$day" } },
      ]),
      StudentLessonProgress.aggregate<{ c?: number }>([
        {
          $match: {
            schoolId: context.schoolId,
            studentId: student._id,
            completionStatus: "completed",
            completedAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $lookup: {
            from: Lesson.collection.name,
            localField: "lessonId",
            foreignField: "_id",
            as: "lesson",
            pipeline: [
              {
                $match: {
                  schoolId: context.schoolId,
                  classGroupId: student.classGroupId,
                  status: "published",
                },
              },
              { $project: { _id: 1 } },
            ],
          },
        },
        { $match: { "lesson.0": { $exists: true } } },
        { $count: "c" },
      ]),
    ]);

    const studiedLessonsCount = studiedAgg[0]?.c ?? 0;
    const studiedPercent = completionRatioPercent(studiedLessonsCount, publishedLessonsTotal);
    const flashcardStatusMap = new Map(flashcardStatusAgg.map((r) => [r._id, r.n]));
    const flashcardsTrackedTotal = flashcardStatusAgg.reduce((sum, r) => sum + r.n, 0);
    const reviewedCards = flashcardReviewAgg[0]?.reviewedCards ?? 0;
    const reviewEvents = flashcardReviewAgg[0]?.reviewEvents ?? 0;
    const completionDays = completionDaysAgg.map((d) => d._id).filter(Boolean);
    const recentCompletionStreakDays = computeRecentCompletionStreakDays(completionDays, now);
    const completedLessonsInLast7Days = completionsInLast7d[0]?.c ?? 0;

    const pageIds = entries.map((e) => e._id);
    const studiedOnPageIds =
      pageIds.length > 0
        ? await StudentLessonProgress.find({
            schoolId: context.schoolId,
            studentId: student._id,
            lessonId: { $in: pageIds },
            completionStatus: "completed",
          })
            .distinct("lessonId")
        : [];
    const studiedOnPage = new Set(studiedOnPageIds.map((id) => String(id)));

    const subjectIds = [
      ...new Set(
        entries.map((e) => e.subjectId).filter(Boolean).map((id) => String(id))
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const subjects = subjectIds.length
      ? ((await Subject.find({ _id: { $in: subjectIds } })
          .select("_id name")
          .lean()) as Array<{ _id: mongoose.Types.ObjectId; name: string }>)
      : [];

    const subjectMap = new Map(subjects.map((s) => [String(s._id), s.name]));

    const data = entries.map((e) => ({
      id: String(e._id),
      title: e.title,
      subjectName: e.subjectId ? subjectMap.get(String(e.subjectId)) || null : null,
      scheduledAt: e.scheduledAt ? new Date(e.scheduledAt).toISOString() : null,
      publishedAt: e.publishedAt ? new Date(e.publishedAt).toISOString() : null,
      studied: studiedOnPage.has(String(e._id)),
    }));

    return Response.json({
      success: true,
      data: {
        lessons: data,
        progress: {
          publishedLessonsTotal,
          studiedLessonsCount,
          studiedPercent,
          revision: {
            flashcardsTrackedTotal,
            flashcardsKnownCount: flashcardStatusMap.get("known") ?? 0,
            flashcardsNeedsReviewCount: flashcardStatusMap.get("needs_review") ?? 0,
            flashcardsLearningCount: flashcardStatusMap.get("learning") ?? 0,
            flashcardsNewCount: flashcardStatusMap.get("new") ?? 0,
            reviewedFlashcardsCount: reviewedCards,
            reviewEventsTotal: reviewEvents,
            recentCompletionStreakDays,
            completedLessonsInLast7Days,
          },
        },
        pagination: {
          total: publishedLessonsTotal,
          limit,
          offset,
          hasMore: offset + data.length < publishedLessonsTotal,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to list student lessons:", e);
    const message = e instanceof Error ? e.message : "Failed to load lessons";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
