import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { ExamInvigilatorAssignment, type IExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import {
  ExamTimetableVersion,
  type IExamTimetableVersion,
} from "@/models/ExamTimetableVersion";
import { ExamVenue } from "@/models/ExamVenue";
import { serializeExamInvigilatorAssignment } from "@/lib/exams/exam-invigilator-service";
import { serializeExamSession } from "@/lib/exams/exam-session-service";
import { serializeExamTimetableEntry } from "@/lib/exams/exam-timetable-entry-service";
import { serializeExamVenue } from "@/lib/exams/exam-venue-service";
import { getExamSessionPublishReadiness } from "@/lib/exams/exam-readiness-service";
import { recordExamTimetablePublished } from "@/lib/exams/exam-publish-audit";
import { notifyExamTimetablePublished } from "@/lib/exams/exam-notifications";
import { syncExamSessionCalendarEvents } from "@/lib/exams/exam-calendar-sync-service";
import {
  getPublishBlockedReason,
  isPublishableExamSessionStatus,
  parseExamObjectId,
} from "@/lib/exams/exam-hardening";
import type {
  ExamPublishReadinessDTO,
  ExamPublishResultDTO,
  ExamTimetableVersionDTO,
  ExamTimetableVersionSnapshotDTO,
} from "@/types/academics/exam-scheduling-engine";

const publishExamTimetableBodySchema = z.object({
  changeSummary: z.string().trim().min(1).max(2000),
  syncToCalendar: z.boolean().optional().default(true),
});

export type PublishExamTimetableBodyInput = z.infer<typeof publishExamTimetableBodySchema>;

export class ExamPublishServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamPublishServiceError";
    this.status = status;
  }
}

export function parsePublishExamTimetableBody(body: unknown) {
  const parsed = publishExamTimetableBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function serializeExamTimetableVersion(doc: IExamTimetableVersion): ExamTimetableVersionDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    examSessionId: String(doc.examSessionId),
    versionNumber: doc.versionNumber,
    status: doc.status,
    changeSummary: doc.changeSummary,
    snapshot: doc.snapshot as ExamTimetableVersionSnapshotDTO,
    publishedBy: String(doc.publishedBy),
    publishedAt: doc.publishedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function loadPublishableExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  const parsedSessionId = parseExamObjectId(input.sessionId);
  if (!parsedSessionId) {
    throw new ExamPublishServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: parsedSessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamPublishServiceError("Exam session not found.", 404);
  }

  if (!isPublishableExamSessionStatus(session.status)) {
    throw new ExamPublishServiceError(
      getPublishBlockedReason(session.status) ??
        "This exam session cannot be published in its current status.",
      409
    );
  }

  return session;
}

async function buildVersionSnapshot(input: {
  schoolId: Types.ObjectId;
  session: IExamSession;
  entries: IExamTimetableEntry[];
  invigilators: IExamInvigilatorAssignment[];
}): Promise<ExamTimetableVersionSnapshotDTO> {
  const venueIds = [
    ...new Set(
      input.entries
        .map((entry) => (entry.venueId ? String(entry.venueId) : null))
        .filter(Boolean) as string[]
    ),
  ];

  const venues = venueIds.length
    ? await ExamVenue.find({
        _id: { $in: venueIds.map((id) => new mongoose.Types.ObjectId(id)) },
        schoolId: input.schoolId,
      }).lean()
    : [];

  return {
    session: serializeExamSession(input.session) as unknown as Record<string, unknown>,
    entries: input.entries.map(
      (entry) => serializeExamTimetableEntry(entry) as unknown as Record<string, unknown>
    ),
    invigilators: input.invigilators.map(
      (row) => serializeExamInvigilatorAssignment(row) as unknown as Record<string, unknown>
    ),
    venues: venues.map(
      (venue) => serializeExamVenue(venue) as unknown as Record<string, unknown>
    ),
  };
}

async function loadExamSessionForVersions(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamPublishServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamPublishServiceError("Exam session not found.", 404);
  }

  if (session.status === "cancelled") {
    throw new ExamPublishServiceError(
      "Version history is not available for cancelled exam sessions.",
      409
    );
  }

  return session;
}

export async function listExamTimetableVersions(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamTimetableVersionDTO[]> {
  await loadExamSessionForVersions(input);

  const versions = await ExamTimetableVersion.find({
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  })
    .sort({ versionNumber: -1 })
    .lean();

  return versions.map((version) => serializeExamTimetableVersion(version as IExamTimetableVersion));
}

export async function getExamTimetableVersionById(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  versionId: string;
}): Promise<ExamTimetableVersionDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.versionId)) {
    throw new ExamPublishServiceError("Invalid version id.", 400);
  }

  const version = await ExamTimetableVersion.findOne({
    _id: input.versionId,
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  }).lean();

  if (!version) {
    throw new ExamPublishServiceError("Exam timetable version not found.", 404);
  }

  return serializeExamTimetableVersion(version as IExamTimetableVersion);
}

export async function publishExamSessionTimetable(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: PublishExamTimetableBodyInput;
}): Promise<ExamPublishResultDTO> {
  const session = await loadPublishableExamSession(input);

  const readiness = await getExamSessionPublishReadiness({
    schoolId: input.schoolId,
    actorId: input.actorId,
    sessionId: input.sessionId,
  });

  if (!readiness.canPublish) {
    throw new ExamPublishServiceError(
      readiness.blockingIssues[0]?.message ?? "Exam timetable is not ready to publish.",
      409
    );
  }

  const [entries, invigilators, latestVersion] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: { $nin: ["cancelled"] },
    }),
    ExamInvigilatorAssignment.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
    }),
    ExamTimetableVersion.findOne({
      schoolId: input.schoolId,
      examSessionId: session._id,
    })
      .sort({ versionNumber: -1 })
      .select("versionNumber")
      .lean(),
  ]);

  const publishableEntries = entries.filter(
    (entry) => entry.status === "draft" || entry.status === "ready" || entry.status === "published"
  );

  const snapshot = await buildVersionSnapshot({
    schoolId: input.schoolId,
    session,
    entries: publishableEntries.map((entry) => entry.toObject() as IExamTimetableEntry),
    invigilators: invigilators.map((row) => row.toObject() as IExamInvigilatorAssignment),
  });

  const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;
  const publishedAt = new Date();

  await ExamTimetableVersion.updateMany(
    {
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: "published",
    },
    { $set: { status: "superseded" } }
  );

  const versionDoc = await ExamTimetableVersion.create({
    schoolId: input.schoolId,
    examSessionId: session._id,
    versionNumber,
    status: "published",
    changeSummary: input.body.changeSummary.trim(),
    snapshot,
    publishedBy: input.actorId,
    publishedAt,
  });

  await ExamTimetableEntry.updateMany(
    {
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: { $in: ["draft", "ready"] },
    },
    {
      $set: {
        status: "published",
        updatedBy: input.actorId,
      },
    }
  );

  session.status = "published";
  session.publishedAt = publishedAt;
  session.publishedBy = input.actorId;
  session.updatedBy = input.actorId;
  await session.save();

  await recordExamTimetablePublished({
    schoolId: input.schoolId,
    actorId: input.actorId,
    examSessionId: session._id as Types.ObjectId,
    versionId: versionDoc._id as Types.ObjectId,
    versionNumber,
    changeSummary: input.body.changeSummary.trim(),
    entryCount: publishableEntries.length,
  });

  void notifyExamTimetablePublished({
    schoolId: input.schoolId,
    session,
    versionNumber,
    changeSummary: input.body.changeSummary.trim(),
  });

  if (input.body.syncToCalendar) {
    void syncExamSessionCalendarEvents({
      schoolId: input.schoolId,
      actorId: input.actorId,
      session,
      entries: publishableEntries.map((entry) => entry.toObject() as IExamTimetableEntry),
      invigilators: invigilators.map((row) => row.toObject() as IExamInvigilatorAssignment),
      versionNumber,
    });
  }

  const version = serializeExamTimetableVersion(versionDoc.toObject() as IExamTimetableVersion);

  return {
    session: serializeExamSession(session),
    version,
    readiness: {
      ...readiness,
      currentVersionNumber: versionNumber,
      canPublish: false,
    } satisfies ExamPublishReadinessDTO,
  };
}
