import { COMPLETE_SUBJECT_RESULT_STATUSES } from "@/lib/academics/compatibility/subject-result-adapters";
import type { SubjectResultStatus } from "@/types/academics/assessment-engine";
import type {
  AcademicProfileAttendanceDTO,
  AcademicProfileCommentsDTO,
  AcademicProfileReadinessDTO,
  AcademicProfileSubjectResultDTO,
  AcademicRecordStatus,
} from "@/types/academics/student-academic-profile";

function isSubmittedSubjectStatus(status: string) {
  return COMPLETE_SUBJECT_RESULT_STATUSES.has(status as SubjectResultStatus);
}

export function buildAcademicProfileReadinessFromSections(input: {
  subjectResults: AcademicProfileSubjectResultDTO[];
  comments: AcademicProfileCommentsDTO;
  attendance: AcademicProfileAttendanceDTO;
  recordStatus: AcademicRecordStatus;
}): AcademicProfileReadinessDTO {
  const subjectsExpected = input.subjectResults.length;
  const submittedRows = input.subjectResults.filter((row) =>
    isSubmittedSubjectStatus(row.status)
  );
  const approvedRows = input.subjectResults.filter(
    (row) => row.status === "approved" || row.status === "locked"
  );

  const missingSubjects = input.subjectResults
    .filter((row) => !isSubmittedSubjectStatus(row.status))
    .map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      reason:
        row.status === "draft" || row.status === "ready"
          ? "Not yet submitted"
          : row.status === "returned"
            ? "Returned for correction"
            : "Incomplete",
    }));

  const attendanceReady =
    input.attendance.source === "report_snapshot" ||
    (input.attendance.attendancePercentage != null &&
      input.attendance.source === "live_homeroom_attendance");

  const commentsReady = Boolean(
    input.comments.classTeacherComment?.trim() ||
      input.comments.headteacherComment?.trim()
  );

  const issues: AcademicProfileReadinessDTO["issues"] = [];

  if (missingSubjects.length > 0) {
    issues.push({
      code: "missing_subjects",
      message: `${missingSubjects.length} subject(s) still need submission.`,
      severity: "warning",
    });
  }

  if (!attendanceReady) {
    issues.push({
      code: "attendance_pending",
      message: "Attendance is not ready for report compilation.",
      severity: "warning",
    });
  }

  if (!input.comments.classTeacherComment?.trim()) {
    issues.push({
      code: "homeroom_comment_pending",
      message: "Class teacher comment is pending.",
      severity: "info",
    });
  }

  return {
    subjectsExpected,
    subjectsSubmitted: submittedRows.length,
    subjectsApproved: approvedRows.length,
    missingSubjects,
    missingRequiredScores: [],
    attendanceReady,
    commentsReady,
    issues,
  };
}
