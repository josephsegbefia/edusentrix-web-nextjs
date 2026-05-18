import "server-only";

import mongoose from "mongoose";
import { Teacher } from "@/models/Teacher";
import { UserMembership } from "@/models/UserMembership";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";
import type { LessonNoteReviewCommentType } from "@/models/LessonNoteReviewComment";

function lessonNoteTeacherActionUrl(noteId: string) {
  return `/teacher/lesson-notes/${noteId}`;
}

function lessonNoteAdminReviewUrl(noteId: string) {
  return `/admin/lesson-notes/${noteId}`;
}

export async function resolveSchoolAdminUserIds(
  schoolId: mongoose.Types.ObjectId,
): Promise<mongoose.Types.ObjectId[]> {
  const memberships = await UserMembership.find({
    schoolId,
    status: "active",
    roles: "school_admin",
  })
    .select("userId")
    .lean();

  return memberships
    .map((row) => row.userId)
    .filter((userId) => mongoose.Types.ObjectId.isValid(String(userId)))
    .map((userId) => userId as mongoose.Types.ObjectId);
}

export async function notifySchoolAdminsLessonNoteSubmitted(input: {
  schoolId: mongoose.Types.ObjectId;
  lessonNoteId: mongoose.Types.ObjectId;
  topic: string;
  teacherDisplayName: string;
  excludeUserId?: mongoose.Types.ObjectId | null;
}) {
  const topicLabel = input.topic?.trim() || "Lesson note";
  const teacherLabel = input.teacherDisplayName?.trim() || "A teacher";
  const reviewerIds = await resolveSchoolAdminUserIds(input.schoolId);
  const exclude = input.excludeUserId ? String(input.excludeUserId) : null;

  await Promise.all(
    reviewerIds
      .filter((userId) => !exclude || String(userId) !== exclude)
      .map((userId) =>
        createTeacherNotification({
          schoolId: input.schoolId,
          userId,
          type: "reminder",
          priority: "high",
          title: "Lesson note awaiting review",
          body: `${teacherLabel} submitted “${topicLabel}” for your review.`,
          actionUrl: lessonNoteAdminReviewUrl(String(input.lessonNoteId)),
          dedupeKey: `lesson_note.submitted:${String(input.lessonNoteId)}:${String(userId)}`,
          metadata: {
            event: "lesson_note.submitted",
            lessonNoteId: String(input.lessonNoteId),
            topic: topicLabel,
          },
        }),
      ),
  );
}

async function resolveTeacherUserId(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
}): Promise<mongoose.Types.ObjectId | null> {
  const teacher = await Teacher.findOne({
    _id: input.teacherId,
    schoolId: input.schoolId,
  })
    .select("userId")
    .lean();

  const userId = teacher?.userId;
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    return null;
  }
  return userId as mongoose.Types.ObjectId;
}

export async function notifyTeacherLessonNoteApproved(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  lessonNoteId: mongoose.Types.ObjectId;
  topic: string;
  feedback?: string | null;
}) {
  const userId = await resolveTeacherUserId({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  });
  if (!userId) return;

  const topicLabel = input.topic?.trim() || "Lesson note";
  const feedbackSuffix = input.feedback?.trim()
    ? ` Feedback: ${input.feedback.trim()}`
    : "";

  await createTeacherNotification({
    schoolId: input.schoolId,
    userId,
    type: "system",
    priority: "normal",
    title: "Lesson note approved",
    body: `“${topicLabel}” was approved. You can create student lessons from this note when your school allows it.${feedbackSuffix}`,
    actionUrl: lessonNoteTeacherActionUrl(String(input.lessonNoteId)),
    dedupeKey: `lesson_note.approved:${String(input.lessonNoteId)}`,
    metadata: {
      event: "lesson_note.approved",
      lessonNoteId: String(input.lessonNoteId),
      topic: topicLabel,
    },
  });
}

export async function notifyTeacherLessonNoteRejected(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  lessonNoteId: mongoose.Types.ObjectId;
  topic: string;
  reason: string;
}) {
  const userId = await resolveTeacherUserId({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  });
  if (!userId) return;

  const topicLabel = input.topic?.trim() || "Lesson note";
  const reason = input.reason.trim();

  await createTeacherNotification({
    schoolId: input.schoolId,
    userId,
    type: "reminder",
    priority: "high",
    title: "Lesson note needs revision",
    body: `“${topicLabel}” was sent back for changes.${reason ? ` ${reason}` : ""}`,
    actionUrl: lessonNoteTeacherActionUrl(String(input.lessonNoteId)),
    dedupeKey: `lesson_note.rejected:${String(input.lessonNoteId)}:${Date.now()}`,
    metadata: {
      event: "lesson_note.rejected",
      lessonNoteId: String(input.lessonNoteId),
      topic: topicLabel,
    },
  });
}

export async function notifyTeacherLessonNoteReviewComment(input: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  lessonNoteId: mongoose.Types.ObjectId;
  commentId: mongoose.Types.ObjectId;
  topic: string;
  sectionLabel: string;
  commentType: LessonNoteReviewCommentType;
  commentPreview: string;
}) {
  const userId = await resolveTeacherUserId({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  });
  if (!userId) return;

  const topicLabel = input.topic?.trim() || "Lesson note";
  const preview =
    input.commentPreview.length > 160
      ? `${input.commentPreview.slice(0, 157)}…`
      : input.commentPreview;

  const isRequired = input.commentType === "required_change";
  const typeLabel =
    input.commentType === "required_change"
      ? "Required change"
      : input.commentType === "question"
        ? "Question"
        : input.commentType === "commendation"
          ? "Commendation"
          : "Suggestion";

  await createTeacherNotification({
    schoolId: input.schoolId,
    userId,
    type: "message",
    priority: isRequired ? "high" : "normal",
    title: isRequired ? "Changes requested on lesson note" : "New review comment",
    body: `${typeLabel} on “${topicLabel}” (${input.sectionLabel}): ${preview}`,
    actionUrl: lessonNoteTeacherActionUrl(String(input.lessonNoteId)),
    dedupeKey: `lesson_note.comment:${String(input.commentId)}`,
    metadata: {
      event: "lesson_note.review_comment",
      lessonNoteId: String(input.lessonNoteId),
      commentId: String(input.commentId),
      commentType: input.commentType,
      sectionLabel: input.sectionLabel,
    },
  });
}
