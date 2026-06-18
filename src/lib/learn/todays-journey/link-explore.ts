import { Types } from "mongoose";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import type { ILearnSubjectJourney } from "@/models/LearnSubjectJourney";
import { ExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { Homework } from "@/models/Homework";
import { StudentExploreRecord } from "@/models/StudentExploreRecord";

export type JourneyExploreSection = {
  status: "locked" | "available" | "generating" | "ready" | "completed";
  adventureId?: string;
  title: string;
  description: string;
  route?: string;
};

export async function resolveLinkedExploreAdventureId(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
) {
  if (journey.linkedExploreAdventureId) {
    return journey.linkedExploreAdventureId;
  }

  if (!journey.subjectOfferingId) return null;

  const adventure = await ExploreAdventure.findOne({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    subjectOfferingId: journey.subjectOfferingId,
    sourceLessonTitle: journey.topicTitle,
    status: { $in: ["teacher_approved", "ready", "teacher_review_recommended"] },
  })
    .sort({ updatedAt: -1 })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  return adventure?._id ?? null;
}

export async function buildJourneyExploreSection(
  context: LearnMobileStudentContext,
  journey: ILearnSubjectJourney
): Promise<JourneyExploreSection> {
  const exploreStep = journey.steps.find((step) => step.key === "explore");
  if (exploreStep?.status === "locked") {
    return {
      status: "locked",
      title: "Explore unlocks after your notes",
      description: "Finish earlier steps to open a deeper mission with Leo.",
    };
  }

  const linkedId = await resolveLinkedExploreAdventureId(context, journey);

  const adventure = linkedId
    ? await ExploreAdventure.findOne({
        _id: linkedId,
        schoolId: context.schoolId,
        classGroupId: context.classGroupId,
      })
        .select("_id title subjectName sourceLessonTitle status")
        .lean<{
          _id: Types.ObjectId;
          title: string;
          subjectName: string;
          sourceLessonTitle: string;
          status: string;
        } | null>()
    : null;

  const activeJob = await ExploreGenerationJob.findOne({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: { $in: ["queued", "generating", "safety_checking", "repairing"] },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();

  if (!adventure) {
    return {
      status: activeJob ? "generating" : "available",
      title: journey.topicTitle,
      description: activeJob
        ? "Leo is preparing an explore mission for your class."
        : "An explore mission will appear when your teacher publishes one.",
    };
  }

  const record = await StudentExploreRecord.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    adventureId: adventure._id,
  })
    .select("status")
    .lean<{ status: string } | null>();

  const status =
    record?.status === "completed"
      ? "completed"
      : adventure.status === "teacher_approved"
        ? "ready"
        : "available";

  return {
    status,
    adventureId: String(adventure._id),
    title: adventure.title,
    description: `Go deeper on ${adventure.sourceLessonTitle || journey.topicTitle} with Leo.`,
    route: `/(student)/explore/${String(adventure._id)}`,
  };
}
