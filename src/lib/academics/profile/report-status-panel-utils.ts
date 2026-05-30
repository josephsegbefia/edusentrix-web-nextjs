import { buildAcademicProfileReadinessFromSections } from "@/lib/academics/profile/build-academic-profile-readiness";
import type {
  AcademicPeriodProfileStatus,
  AcademicRecordStatus,
  StudentAcademicProfileDTO,
} from "@/types/academics/student-academic-profile";

export type ReportStatusPanelRowTone = "success" | "warning" | "neutral" | "error";

export type ReportStatusPanelRow = {
  label: string;
  value: string;
  tone?: ReportStatusPanelRowTone;
};

export type ReportStatusPanelActions = {
  canView: boolean;
  canDownload: boolean;
  downloadUrl: string | null;
  viewHref: string | null;
  downloadLabel: string;
};

export type ReportStatusPanelModel = {
  title: string;
  badgeStatus: AcademicPeriodProfileStatus;
  showStaffDetails: boolean;
  parentMessage: string | null;
  rows: ReportStatusPanelRow[];
  actions: ReportStatusPanelActions;
};

const RECORD_STATUS_BADGE: Record<AcademicRecordStatus, AcademicPeriodProfileStatus> = {
  no_data: "no_data",
  in_progress: "in_progress",
  submitted: "in_progress",
  compiled: "compiled",
  approved: "approved",
  released: "released",
  legacy: "legacy",
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readinessLabel(ready: boolean) {
  return ready ? "Ready" : "Pending";
}

function readinessTone(ready: boolean): ReportStatusPanelRowTone {
  return ready ? "success" : "warning";
}

function headteacherApprovalLabel(status: AcademicRecordStatus) {
  if (status === "released" || status === "approved") return "Approved";
  if (status === "compiled") return "Awaiting approval";
  if (status === "submitted") return "Submitted for review";
  return "Not started";
}

export function buildAdminReportCardViewHref(input: {
  studentId: string;
  academicPeriodId: string | null;
}) {
  if (!input.academicPeriodId) return null;
  const params = new URLSearchParams({
    studentId: input.studentId,
    academicPeriodId: input.academicPeriodId,
  });
  return `/admin/reports/cards/view?${params.toString()}`;
}

function resolveReadiness(profile: StudentAcademicProfileDTO) {
  if (profile.reportStatus.readiness) {
    return profile.reportStatus.readiness;
  }
  if (profile.subjectResults.length === 0) {
    return null;
  }
  return buildAcademicProfileReadinessFromSections({
    subjectResults: profile.subjectResults,
    comments: profile.comments,
    attendance: profile.attendance,
    recordStatus: profile.recordStatus,
  });
}

function buildReleasedStaffRows(profile: StudentAcademicProfileDTO): ReportStatusPanelRow[] {
  const rows: ReportStatusPanelRow[] = [
    {
      label: "Report card status",
      value: profile.reportStatus.label,
      tone: "success",
    },
  ];

  const releasedOn = formatDate(profile.reportStatus.releasedAt ?? profile.reportCard.releasedAt);
  if (releasedOn) {
    rows.push({ label: "Released on", value: releasedOn, tone: "neutral" });
  }

  if (profile.reportCard.verificationId) {
    rows.push({
      label: "Verification ID",
      value: profile.reportCard.verificationId,
      tone: "neutral",
    });
  }

  if (profile.reportCard.templateName) {
    rows.push({
      label: "Template",
      value: profile.reportCard.templateName,
      tone: "neutral",
    });
  }

  return rows;
}

function buildInProgressStaffRows(profile: StudentAcademicProfileDTO): ReportStatusPanelRow[] {
  const readiness = resolveReadiness(profile);
  const rows: ReportStatusPanelRow[] = [
    {
      label: "Report card status",
      value: profile.reportStatus.label,
      tone: profile.reportStatus.isProvisional ? "warning" : "neutral",
    },
  ];

  if (!readiness) {
    rows.push({
      label: "Progress",
      value: "No subject results recorded for this period yet.",
      tone: "neutral",
    });
    return rows;
  }

  rows.push({
    label: "Subjects submitted",
    value: `${readiness.subjectsSubmitted} / ${readiness.subjectsExpected}`,
    tone:
      readiness.subjectsSubmitted >= readiness.subjectsExpected
        ? "success"
        : "warning",
  });

  if (readiness.missingSubjects.length > 0) {
    rows.push({
      label: "Missing subjects",
      value: readiness.missingSubjects.map((entry) => entry.subjectName).join(", "),
      tone: "warning",
    });
  }

  rows.push({
    label: "Attendance",
    value: readinessLabel(readiness.attendanceReady),
    tone: readinessTone(readiness.attendanceReady),
  });

  rows.push({
    label: "Class teacher comment",
    value: profile.comments.classTeacherComment?.trim()
      ? "Ready"
      : "Pending",
    tone: profile.comments.classTeacherComment?.trim() ? "success" : "warning",
  });

  rows.push({
    label: "Headteacher approval",
    value: headteacherApprovalLabel(profile.reportStatus.status),
    tone:
      profile.reportStatus.status === "approved" ||
      profile.reportStatus.status === "released"
        ? "success"
        : "neutral",
  });

  if (readiness.issues.length > 0 && profile.permissions.canViewMissingMarks) {
    rows.push({
      label: "Open issues",
      value: String(readiness.issues.length),
      tone: readiness.issues.some((issue) => issue.severity === "error")
        ? "error"
        : "warning",
    });
  }

  return rows;
}

function buildSubjectTeacherRows(profile: StudentAcademicProfileDTO): ReportStatusPanelRow[] {
  const visibleIds = profile.permissions.visibleSubjectIds;
  const scoped = visibleIds?.length
    ? profile.subjectResults.filter((row) => visibleIds.includes(row.subjectId))
    : profile.subjectResults;

  if (scoped.length === 0) {
    return [
      {
        label: "Your subjects",
        value: "No subject results for this period in your assignments.",
        tone: "neutral",
      },
    ];
  }

  const submitted = scoped.filter(
    (row) => row.status === "submitted" || row.status === "approved" || row.status === "locked"
  ).length;

  return [
    {
      label: "Report card status",
      value: profile.reportStatus.isReleased ? "Released" : profile.reportStatus.label,
      tone: profile.reportStatus.isReleased ? "success" : "neutral",
    },
    {
      label: "Your subjects submitted",
      value: `${submitted} / ${scoped.length}`,
      tone: submitted >= scoped.length ? "success" : "warning",
    },
  ];
}

function buildLearnerGuardianMessage(profile: StudentAcademicProfileDTO): string {
  const isStudent = profile.visibilityMode === "student";

  if (profile.reportStatus.isReleased) {
    const releasedOn = formatDate(
      profile.reportStatus.releasedAt ?? profile.reportCard.releasedAt
    );
    if (isStudent) {
      return releasedOn
        ? `Your official report card for this period was published on ${releasedOn}.`
        : "Your official report card for this period is available.";
    }
    return releasedOn
      ? `The official report card for this period was released on ${releasedOn}.`
      : "The official report card for this period has been released.";
  }

  if (profile.permissions.canViewProvisionalScores && profile.recordStatus !== "no_data") {
    return isStudent
      ? "Your teachers are still finalizing this term. These results are not your official report card yet."
      : "Results are still being finalized. This is not an official report card yet.";
  }

  return isStudent
    ? "Your official report card is not ready for this period yet. Check back after your school publishes results."
    : "No released report card is available for this period yet. Check back after the school publishes results.";
}

export function buildReportStatusPanelModel(
  profile: StudentAcademicProfileDTO
): ReportStatusPanelModel {
  const { permissions, reportStatus, reportCard } = profile;
  const periodId = profile.selectedPeriod.academicPeriodId;
  const isParentOrStudent =
    profile.visibilityMode === "parent" || profile.visibilityMode === "student";

  const canView =
    permissions.canViewReportCard &&
    Boolean(periodId) &&
    (reportCard.canView || reportStatus.isReleased || reportStatus.studentReportCardId);
  const canDownloadStaff =
    reportCard.canDownload && Boolean(reportCard.downloadUrl);
  const viewHref = canView
    ? buildAdminReportCardViewHref({
        studentId: profile.studentId,
        academicPeriodId: periodId,
      })
    : null;

  const badgeStatus = RECORD_STATUS_BADGE[profile.recordStatus] ?? "no_data";

  if (isParentOrStudent) {
    const canDownloadParent =
      reportStatus.isReleased &&
      (Boolean(reportCard.downloadUrl) ||
        Boolean(reportStatus.studentReportCardId));
    return {
      title: "Report card",
      badgeStatus,
      showStaffDetails: false,
      parentMessage: buildLearnerGuardianMessage(profile),
      rows: [],
      actions: {
        canView: false,
        canDownload: canDownloadParent,
        downloadUrl: reportCard.downloadUrl,
        viewHref: null,
        downloadLabel: "Download report",
      },
    };
  }

  if (profile.visibilityMode === "subject_teacher") {
    return {
      title: "Report status",
      badgeStatus,
      showStaffDetails: true,
      parentMessage: null,
      rows: buildSubjectTeacherRows(profile),
      actions: {
        canView,
        canDownload: canDownloadStaff,
        downloadUrl: reportCard.downloadUrl,
        viewHref,
        downloadLabel: "Download report",
      },
    };
  }

  const showStaffDetails = permissions.canViewReadiness;
  const isReleased = reportStatus.isReleased;

  return {
    title: "Report card status",
    badgeStatus,
    showStaffDetails,
    parentMessage: null,
    rows: isReleased
      ? buildReleasedStaffRows(profile)
      : showStaffDetails
        ? buildInProgressStaffRows(profile)
        : [
            {
              label: "Status",
              value: reportStatus.label,
              tone: "neutral",
            },
          ],
    actions: {
      canView,
      canDownload: canDownloadStaff,
      downloadUrl: reportCard.downloadUrl,
      viewHref,
      downloadLabel: "Download report",
    },
  };
}
