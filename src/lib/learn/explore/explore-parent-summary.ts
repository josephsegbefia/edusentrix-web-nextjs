import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildExploreAdventureId,
  parseExploreAdventureId,
} from "@/lib/learn/explore/build-generation-key";
import { loadExploreSnapshotForAdventure } from "@/lib/learn/explore/explore-content.service";
import {
  buildExploreParentSummary,
  type ExploreParentSummary,
} from "@/lib/learn/explore/explore-parent-summary-builder";
import { ExploreAdventure } from "@/models/ExploreAdventure";
import {
  StudentExploreRecord,
  type IStudentExploreRecord,
} from "@/models/StudentExploreRecord";

export type { ExploreParentSummary } from "@/lib/learn/explore/explore-parent-summary-builder";
export { buildExploreParentSummary } from "@/lib/learn/explore/explore-parent-summary-builder";

export type GetParentExploreSummaryResult =
  | { ok: true; data: ExploreParentSummary }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_AVAILABLE" | "HIDDEN";
      message: string;
      friendlyMessage: string;
      status: number;
    };

export async function getParentExploreSummaryForStudent(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  adventureId: string;
}): Promise<GetParentExploreSummaryResult> {
  await connectToDatabase();

  const adventureObjectId = parseExploreAdventureId(input.adventureId);
  if (!adventureObjectId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Invalid adventure id.",
      friendlyMessage: "We could not find that Explore mission.",
      status: 404,
    };
  }

  const adventure = await ExploreAdventure.findOne({
    _id: new Types.ObjectId(adventureObjectId),
    schoolId: input.schoolId,
  })
    .select("title subjectName sourceLessonTitle gradeLevel status")
    .lean<{
      title: string;
      subjectName: string;
      sourceLessonTitle: string;
      gradeLevel: string;
      status: string;
    } | null>();

  if (!adventure) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Adventure not found.",
      friendlyMessage: "We could not find that Explore mission.",
      status: 404,
    };
  }

  if (adventure.status === "hidden" || adventure.status === "blocked") {
    return {
      ok: false,
      code: "HIDDEN",
      message: "Adventure not available.",
      friendlyMessage: "This mission is not available to view right now.",
      status: 404,
    };
  }

  const record = await StudentExploreRecord.findOne({
    studentId: input.studentId,
    schoolId: input.schoolId,
    adventureId: new Types.ObjectId(adventureObjectId),
  }).lean<IStudentExploreRecord | null>();

  if (!record) {
    return {
      ok: false,
      code: "NOT_AVAILABLE",
      message: "No student record for this adventure.",
      friendlyMessage:
        "Your child has not started this Explore mission yet. Check back after they try it in EduSentrix Learn.",
      status: 404,
    };
  }

  if (record.status === "not_started") {
    return {
      ok: false,
      code: "NOT_AVAILABLE",
      message: "Adventure not started.",
      friendlyMessage: "Your child has not started this Explore mission yet.",
      status: 404,
    };
  }

  const loaded = await loadExploreSnapshotForAdventure(
    new Types.ObjectId(adventureObjectId)
  );

  if (!loaded || String(loaded.snapshot._id) !== String(record.contentSnapshotId)) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Snapshot missing.",
      friendlyMessage: "We could not load the learning content for this mission.",
      status: 404,
    };
  }

  const exploredAt =
    record.completedAt?.toISOString() ??
    record.quizSubmittedAt?.toISOString() ??
    record.startedAt?.toISOString() ??
    record.updatedAt.toISOString();

  const data = buildExploreParentSummary({
    adventureId: buildExploreAdventureId(new Types.ObjectId(adventureObjectId)),
    studentId: String(input.studentId),
    title: adventure.title,
    subjectName: adventure.subjectName,
    sourceLessonTitle: adventure.sourceLessonTitle,
    gradeName: loaded.snapshot.content.gradeName ?? adventure.gradeLevel,
    exploredAt,
    record,
    content: loaded.snapshot.content,
  });

  return { ok: true, data };
}
