import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { getAppUrl } from "@/lib/utils/getAppUrl";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function queueLessonPublishedStudentEmail(params: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  lessonTitle: string;
}): Promise<void> {
  try {
    const [{ sendTrackedBrevoEmail }, { stripHtml }] = await Promise.all([
      import("@/lib/email"),
      import("@/lib/email/branded-template"),
    ]);
    const u = await User.findById(params.userId).select("email firstName").lean();
    if (!u) return;
    const email = u.email?.trim();
    if (!email) return;

    const school = await School.findById(params.schoolId).select("name logo").lean();
    const appUrl = getAppUrl();
    const path = `/student/lessons/${String(params.lessonId)}`;
    const href = path.startsWith("http") ? path : `${appUrl.replace(/\/$/, "")}${path}`;

    const titleLine =
      params.lessonTitle.trim().length > 0
        ? `<strong>${escapeHtml(params.lessonTitle.trim())}</strong> is now available.`
        : "A new lesson is now available for your class.";

    const innerHtml = `<p>Hi${u.firstName ? ` ${escapeHtml(u.firstName)}` : ""},</p><p>${titleLine}</p><p><a href="${href}">Open the lesson in EduSentrix</a></p>`;

    const htmlContent = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${innerHtml}</div>`;

    await sendTrackedBrevoEmail({
      to: email,
      toName: u.firstName ?? null,
      subject: "New lesson published",
      htmlContent,
      textContent: stripHtml(htmlContent),
      templateKey: "LESSON_PUBLISHED_STUDENT",
      schoolId: String(params.schoolId),
      schoolName: school?.name ?? null,
      schoolLogo: (school as { logo?: string } | null)?.logo ?? null,
      recipientUserId: String(params.userId),
      recipientRole: "student",
      async: true,
    });
  } catch (e) {
    console.error("[lessons] queueLessonPublishedStudentEmail failed:", e);
  }
}

/**
 * In-app + optional transactional email for students (Clerk-linked, verified email) when a lesson is published.
 */
export async function notifyStudentsOfPublishedLesson(input: {
  schoolId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  lessonTitle: string;
  publishedAt: Date;
}): Promise<void> {
  const { schoolId, lessonId, classGroupId, lessonTitle, publishedAt } = input;

  const students = await Student.find({
    schoolId,
    classGroupId,
    status: "active",
    userId: { $exists: true, $ne: null },
  })
    .select("_id userId")
    .lean();

  const dedupeKey = `lesson-published:${String(lessonId)}:${publishedAt.toISOString()}`;
  const actionUrl = `/student/lessons/${String(lessonId)}`;
  const title = "New lesson published";
  const body =
    lessonTitle.trim().length > 0
      ? `${lessonTitle.trim()} is now available to read.`
      : "A new lesson is now available to read.";

  await Promise.all(
    students.map(async (row) => {
      const userId = row.userId;
      if (!userId) return;
      await createTeacherNotification({
        schoolId,
        userId,
        type: "announcement",
        title,
        body,
        actionUrl,
        entityType: "Lesson",
        entityId: lessonId,
        dedupeKey,
        metadata: { module: "lessons", studentId: String(row._id) },
      });
      void queueLessonPublishedStudentEmail({
        schoolId,
        userId,
        lessonId,
        lessonTitle,
      });
    })
  );
}
