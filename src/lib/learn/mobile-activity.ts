import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LearnActivityEvent, type LearnActivityEventType } from "@/models/LearnActivityEvent";

export async function recordLearnMobileActivity(input: {
  schoolId: Types.ObjectId;
  studentId: Types.ObjectId;
  accountId?: Types.ObjectId | null;
  gradeId?: Types.ObjectId | null;
  classGroupId?: Types.ObjectId | null;
  eventType: LearnActivityEventType;
  topic?: string | null;
  score?: number | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
}) {
  await connectToDatabase();

  const durationSeconds =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? Math.min(Math.round(input.durationSeconds), 7200)
      : null;

  await LearnActivityEvent.create({
    schoolId: input.schoolId,
    studentId: input.studentId,
    accountId: input.accountId ?? null,
    gradeId: input.gradeId ?? null,
    classGroupId: input.classGroupId ?? null,
    eventType: input.eventType,
    occurredAt: new Date(),
    topic: input.topic?.trim() || null,
    score: typeof input.score === "number" ? input.score : null,
    durationSeconds,
    metadata: input.metadata ?? null,
  });
}
