import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  applyExploreAdminReviewAction,
  getLazyExploreDetailForAdminQa,
  listSchoolLazyExploreForAdminQa,
  type ExploreAdminQaDetail,
  type ExploreAdminQaListItem,
  type ExploreAdminReviewActionInput,
} from "@/lib/learn/learn-explore-admin-qa";
import { buildAdventureId, parseAdventureId } from "@/lib/learn/mobile-explore";
import type { AdventureMetadata } from "@/lib/learn/mobile-explore";
import { getTeacherLearnClassIds, type TeacherLearnContext } from "@/lib/learn/teacher-learn-scope";
import { ClassGroup } from "@/models/ClassGroup";
import { LearnGuidedAdventure } from "@/models/LearnGuidedAdventure";
import { Student } from "@/models/Student";
import { SubjectOffering } from "@/models/SubjectOffering";

type AdventureRow = {
  _id: Types.ObjectId;
  title: string;
  topic?: string | null;
  status: string;
  progressPercent: number;
  studentId: Types.ObjectId;
  classGroupId?: Types.ObjectId | null;
  subjectOfferingId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  metadata?: AdventureMetadata | null;
};

function studentName(student: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeExploreQaListItem(row: AdventureRow, maps: {
  studentMap: Map<string, string>;
  classMap: Map<string, string>;
  subjectMap: Map<string, string>;
}) {
  const content = row.metadata?.content;
  const quizAttempt = row.metadata?.quizAttempt;

  return {
    adventureId: buildAdventureId(row._id),
    title: row.title,
    topic: row.topic || content?.sourceLessonTitle || null,
    sessionId: row.metadata?.sessionId || content?.sourceLessonId || null,
    sessionTitle: content?.sourceLessonTitle || row.topic || row.title,
    studentId: String(row.studentId),
    studentName: maps.studentMap.get(String(row.studentId)) || "Student",
    classGroupId: row.classGroupId ? String(row.classGroupId) : null,
    classGroupName: row.classGroupId
      ? maps.classMap.get(String(row.classGroupId)) || "Class"
      : null,
    subjectName: content?.subjectName || (row.subjectOfferingId
      ? maps.subjectMap.get(String(row.subjectOfferingId)) || "Subject"
      : "Subject"),
    status: row.status,
    generatedBy: row.metadata?.generatedBy || "template",
    reviewedStatus: row.metadata?.reviewedStatus || "published",
    contentVersion: row.metadata?.contentVersion ?? 1,
    introPreview: content?.intro?.slice(0, 160) || "",
    readingCount: content?.readingTasks?.length ?? 0,
    funFactCount: content?.funFacts?.length ?? 0,
    quizQuestionCount: content?.endingQuiz?.questions?.length ?? 0,
    quizSubmitted: Boolean(quizAttempt),
    quizScorePercent: quizAttempt?.scorePercent ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadLookupMaps(
  schoolId: Types.ObjectId,
  rows: AdventureRow[]
) {
  const studentIds = Array.from(new Set(rows.map((row) => String(row.studentId))));
  const classIds = Array.from(
    new Set(rows.map((row) => row.classGroupId).filter(Boolean).map(String))
  );
  const subjectIds = Array.from(
    new Set(rows.map((row) => row.subjectOfferingId).filter(Boolean).map(String))
  );

  const [students, classes, subjects] = await Promise.all([
    Student.find({ schoolId, _id: { $in: studentIds } })
      .select("_id firstName middleName lastName")
      .lean<
        Array<{
          _id: Types.ObjectId;
          firstName?: string | null;
          middleName?: string | null;
          lastName?: string | null;
        }>
      >(),
    ClassGroup.find({ schoolId, _id: { $in: classIds } })
      .select("_id name")
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    SubjectOffering.find({ schoolId, _id: { $in: subjectIds } })
      .select("_id displayName shortName")
      .lean<Array<{ _id: Types.ObjectId; displayName?: string; shortName?: string }>>(),
  ]);

  return {
    studentMap: new Map(students.map((s) => [String(s._id), studentName(s)])),
    classMap: new Map(classes.map((c) => [String(c._id), c.name])),
    subjectMap: new Map(
      subjects.map((s) => [String(s._id), s.shortName || s.displayName || "Subject"])
    ),
  };
}

export type { ExploreAdminQaDetail, ExploreAdminQaListItem, ExploreAdminReviewActionInput };

export async function listSchoolExploreContentForQa(
  schoolId: Types.ObjectId,
  filters?: {
    classGroupId?: string;
    studentId?: string;
    limit?: number;
  }
) {
  const lazy = await listSchoolLazyExploreForAdminQa(schoolId, {
    classGroupId: filters?.classGroupId,
    limit: filters?.limit,
  });

  if (lazy.total > 0) {
    return {
      adventures: lazy.adventures,
      total: lazy.total,
      source: lazy.source,
    };
  }

  await connectToDatabase();

  const query: Record<string, unknown> = {
    schoolId,
    "metadata.content": { $exists: true },
  };

  if (filters?.classGroupId && Types.ObjectId.isValid(filters.classGroupId)) {
    query.classGroupId = new Types.ObjectId(filters.classGroupId);
  }
  if (filters?.studentId && Types.ObjectId.isValid(filters.studentId)) {
    query.studentId = new Types.ObjectId(filters.studentId);
  }

  const rows = await LearnGuidedAdventure.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.min(filters?.limit ?? 40, 100))
    .lean<AdventureRow[]>();

  const maps = await loadLookupMaps(schoolId, rows);

  return {
    adventures: rows.map((row) => serializeExploreQaListItem(row, maps)),
    total: rows.length,
    source: "legacy" as const,
  };
}

export async function listTeacherExploreContentForQa(
  ctx: TeacherLearnContext,
  filters?: {
    classGroupId?: string;
    studentId?: string;
    limit?: number;
  }
) {
  const classIds = await getTeacherLearnClassIds(ctx);
  if (!classIds.length) {
    return { adventures: [], total: 0, source: "lazy" as const };
  }

  const lazy = await listSchoolLazyExploreForAdminQa(ctx.schoolId, {
    classGroupId: filters?.classGroupId,
    limit: filters?.limit,
  });

  const scopedLazy = lazy.adventures.filter((item) =>
    classIds.some((id) => String(id) === item.classGroupId)
  );

  if (scopedLazy.length > 0) {
    return {
      adventures: scopedLazy,
      total: scopedLazy.length,
      source: lazy.source,
    };
  }

  await connectToDatabase();

  let scopedClassIds = classIds;
  if (filters?.classGroupId && Types.ObjectId.isValid(filters.classGroupId)) {
    const requested = new Types.ObjectId(filters.classGroupId);
    if (!classIds.some((id) => String(id) === String(requested))) {
      return { adventures: [], total: 0 };
    }
    scopedClassIds = [requested];
  }

  const query: Record<string, unknown> = {
    schoolId: ctx.schoolId,
    classGroupId: { $in: scopedClassIds },
    "metadata.content": { $exists: true },
  };

  if (filters?.studentId && Types.ObjectId.isValid(filters.studentId)) {
    const student = await Student.findOne({
      _id: new Types.ObjectId(filters.studentId),
      schoolId: ctx.schoolId,
      classGroupId: { $in: scopedClassIds },
    })
      .select("_id")
      .lean<{ _id: Types.ObjectId } | null>();
    if (!student) return { adventures: [], total: 0 };
    query.studentId = student._id;
  }

  const rows = await LearnGuidedAdventure.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.min(filters?.limit ?? 40, 100))
    .lean<AdventureRow[]>();

  const maps = await loadLookupMaps(ctx.schoolId, rows);

  return {
    adventures: rows.map((row) => serializeExploreQaListItem(row, maps)),
    total: rows.length,
    source: "legacy" as const,
  };
}

export async function getExploreContentDetailForQa(
  schoolId: Types.ObjectId,
  adventureId: string,
  scope?: { classGroupIds?: Types.ObjectId[] }
) {
  const lazyDetail = await getLazyExploreDetailForAdminQa(schoolId, adventureId, scope);
  if (lazyDetail) {
    return { ...lazyDetail, source: "lazy" as const };
  }

  await connectToDatabase();

  const objectId = parseAdventureId(adventureId);
  if (!objectId) return null;

  const query: Record<string, unknown> = {
    _id: objectId,
    schoolId,
    "metadata.content": { $exists: true },
  };

  if (scope?.classGroupIds?.length) {
    query.classGroupId = { $in: scope.classGroupIds };
  }

  const row = await LearnGuidedAdventure.findOne(query).lean<AdventureRow | null>();
  if (!row?.metadata?.content) return null;

  const maps = await loadLookupMaps(schoolId, [row]);
  const listItem = serializeExploreQaListItem(row, maps);

  return {
    ...listItem,
    content: row.metadata.content,
    quizAttempt: row.metadata.quizAttempt ?? null,
    source: "legacy" as const,
  };
}

export { adminRegenerateExploreAdventure } from "@/lib/learn/explore/explore-lazy-generate.service";

export async function applySchoolExploreAdminReview(input: {
  schoolId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  adventureId: string;
  action: ExploreAdminReviewActionInput;
  notes?: string;
}) {
  return applyExploreAdminReviewAction({
    schoolId: input.schoolId,
    reviewerId: input.reviewerId,
    reviewerRole: "school_admin",
    adventureId: input.adventureId,
    action: input.action,
    notes: input.notes,
  });
}

export async function applyTeacherExploreAdminReview(input: {
  schoolId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  adventureId: string;
  action: ExploreAdminReviewActionInput;
  notes?: string;
}) {
  return applyExploreAdminReviewAction({
    schoolId: input.schoolId,
    reviewerId: input.reviewerId,
    reviewerRole: "class_teacher",
    adventureId: input.adventureId,
    action: input.action,
    notes: input.notes,
  });
}
