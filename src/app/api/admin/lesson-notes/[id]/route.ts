import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import {
  LessonNoteReviewComment,
  type ILessonNoteReviewComment,
} from "@/models/LessonNoteReviewComment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import {
  countOpenReviewComments,
  formatUserDisplayName,
} from "@/lib/lesson-notes/review";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function serializeReviewComments(
  comments: ILessonNoteReviewComment[],
  userMap: Map<
    string,
    { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }
  >
) {
  return comments.map((comment) => ({
    id: String(comment._id),
    lessonNoteId: String(comment.lessonNoteId),
    sectionKey: comment.sectionKey,
    sectionLabel: comment.sectionLabel,
    commentType: comment.commentType,
    comment: comment.comment,
    status: comment.status,
    authorId: String(comment.authorId),
    authorName: formatUserDisplayName(
      userMap.get(String(comment.authorId)),
      "Reviewer"
    ),
    addressedAt: comment.addressedAt ? new Date(comment.addressedAt).toISOString() : null,
    addressedBy: comment.addressedBy ? String(comment.addressedBy) : null,
    addressedByName: comment.addressedBy
      ? formatUserDisplayName(userMap.get(String(comment.addressedBy)), "Teacher")
      : null,
    resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt).toISOString() : null,
    resolvedBy: comment.resolvedBy ? String(comment.resolvedBy) : null,
    resolvedByName: comment.resolvedBy
      ? formatUserDisplayName(userMap.get(String(comment.resolvedBy)), "Reviewer")
      : null,
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString(),
  }));
}

function formatLessonNoteResponse(
  entry: ILessonNote,
  className: string,
  subjectName: string | null,
  teacherName: string | null,
  reviewComments: ReturnType<typeof serializeReviewComments>
) {
  return {
    id: String(entry._id),
    schoolId: String(entry.schoolId),
    teacherId: String(entry.teacherId),
    teacherName,
    classGroupId: String(entry.classGroupId),
    className,
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    subjectName,
    academicPeriodId: entry.academicPeriodId ? String(entry.academicPeriodId) : null,
    templateType: entry.templateType || "SIMPLE",
    curriculumCode: (entry as unknown as Record<string, unknown>).curriculumCode || null,
    curriculumMetadata:
      (entry as unknown as Record<string, unknown>).curriculumMetadata || null,
    unitPlannerData: (entry as unknown as Record<string, unknown>).unitPlannerData || null,
    weekOf: entry.weekOf ? new Date(entry.weekOf).toISOString() : null,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    topic: entry.topic,
    durationMinutes: entry.durationMinutes || null,
    references: entry.references || [],
    curriculum: entry.curriculum || null,
    tlms: entry.tlms || [],
    body: entry.body || null,
    assessment: entry.assessment || null,
    reflections: entry.reflections || null,
    resources: entry.resources || [],
    tags: entry.tags || [],
    status: entry.status,
    submittedAt: entry.submittedAt ? new Date(entry.submittedAt).toISOString() : null,
    approvedAt: entry.approvedAt ? new Date(entry.approvedAt).toISOString() : null,
    approvedBy: entry.approvedBy ? String(entry.approvedBy) : null,
    rejectionReason: entry.rejectionReason || null,
    exportUrls: entry.exportUrls || null,
    objectives: entry.objectives || null,
    content: entry.content || null,
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
    reviewComments,
    openCommentCount: countOpenReviewComments(reviewComments),
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await params;

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json(
        { success: false, error: "Invalid lesson note ID" },
        { status: 400 }
      );
    }

    const entry = (await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
    }).lean()) as ILessonNote | null;

    if (!entry) {
      return Response.json(
        { success: false, error: "Lesson note not found" },
        { status: 404 }
      );
    }

    const [classGroup, subject, teacher, comments] = await Promise.all([
      ClassGroup.findById(entry.classGroupId).select("name gradeId").lean(),
      entry.subjectId
        ? Subject.findById(entry.subjectId).select("name").lean()
        : Promise.resolve(null),
      Teacher.findById(entry.teacherId).select("userId").lean(),
      LessonNoteReviewComment.find({
        schoolId: context.schoolId,
        lessonNoteId: noteId,
      })
        .sort({ createdAt: -1 })
        .lean() as Promise<ILessonNoteReviewComment[]>,
    ]);

    let className = (classGroup as { name?: string } | null)?.name || "";
    if ((classGroup as { gradeId?: mongoose.Types.ObjectId } | null)?.gradeId) {
      const grade = (await Grade.findById(
        (classGroup as { gradeId: mongoose.Types.ObjectId }).gradeId
      )
        .select("name")
        .lean()) as { name?: string } | null;
      if (grade?.name) {
        className = `${grade.name} ${className}`.trim();
      }
    }

    const userIds = Array.from(
      new Set(
        [
          (teacher as { userId?: mongoose.Types.ObjectId } | null)?.userId,
          ...comments.map((comment) => comment.authorId),
          ...comments.map((comment) => comment.addressedBy).filter(Boolean),
          ...comments.map((comment) => comment.resolvedBy).filter(Boolean),
        ]
          .filter(Boolean)
          .map((value) => String(value))
      )
    ).map((value) => new mongoose.Types.ObjectId(value));

    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select("_id name firstName lastName email")
          .lean()
      : [];

    const userMap = new Map(
      users.map(
        (user: {
          _id: mongoose.Types.ObjectId;
          name?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        }) => [String(user._id), user]
      )
    );

    const reviewComments = serializeReviewComments(comments, userMap);
    const teacherName =
      (teacher as { userId?: mongoose.Types.ObjectId } | null)?.userId
        ? formatUserDisplayName(
            userMap.get(String((teacher as { userId: mongoose.Types.ObjectId }).userId)),
            "Unknown teacher"
          )
        : "Unknown teacher";

    return Response.json({
      success: true,
      data: formatLessonNoteResponse(
        entry,
        className,
        (subject as { name?: string } | null)?.name || null,
        teacherName,
        reviewComments
      ),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch admin lesson note:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch admin lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
