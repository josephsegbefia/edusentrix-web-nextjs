import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";
import {
  buildAcademicSummaryCardsFromProfile,
  type AcademicSummaryCardsModel,
} from "@/lib/academics/profile/academic-summary-cards-utils";

/** Removes staff-only fields before returning profile data to parents or students. */
export function sanitizeProfileForLearnerView(
  profile: StudentAcademicProfileDTO
): StudentAcademicProfileDTO {
  return {
    ...profile,
    reportStatus: {
      ...profile.reportStatus,
      readiness: null,
    },
    comments: {
      subjectComments: profile.comments.subjectComments,
      classTeacherComment: profile.comments.classTeacherComment,
      headteacherComment: profile.comments.headteacherComment,
      conduct: profile.comments.conduct,
      interest: profile.comments.interest,
      attitude: profile.comments.attitude,
    },
  };
}

/** Student/parent-facing summary card copy (no readiness or staff jargon). */
export function buildLearnerAcademicSummaryCardsFromProfile(
  profile: StudentAcademicProfileDTO
): AcademicSummaryCardsModel {
  const base = buildAcademicSummaryCardsFromProfile(profile);
  const { summary, reportStatus, attendance } = profile;
  const isReleased = reportStatus.isReleased;

  const averageSubtitle = isReleased
    ? "From your official report card"
    : profile.recordStatus === "no_data"
      ? "Grades will appear when your school publishes them"
      : "Based on results your school has shared so far";

  const positionSubtitle =
    typeof summary.totalStudents === "number"
      ? `Out of ${summary.totalStudents} students in your class`
      : "Rank not available yet";

  const attendanceSubtitle =
    attendance.source === "report_snapshot"
      ? "Recorded on your report card"
      : attendance.source === "live_homeroom_attendance"
        ? "Updated from class attendance"
        : attendance.note ?? "No attendance recorded for this period";

  const reportSubtitle = isReleased
    ? reportStatus.releasedAt
      ? `Published ${new Date(reportStatus.releasedAt).toLocaleDateString()}`
      : "Published by your school"
    : "Your school will share your official report card when it is ready";

  return {
    average: {
      ...base.average,
      title: isReleased ? "Your term average" : "Your average so far",
      subtitle: averageSubtitle,
    },
    position: {
      ...base.position,
      title: isReleased ? "Your class rank" : "Class rank",
      subtitle: positionSubtitle,
    },
    attendance: {
      ...base.attendance,
      title: "Attendance",
      subtitle: attendanceSubtitle,
    },
    reportStatus: {
      ...base.reportStatus,
      title: "Report card",
      value: isReleased ? "Available" : reportStatus.label,
      subtitle: reportSubtitle,
    },
  };
}
