import type {
  AcademicProfileCommentsDTO,
  AcademicProfileSubjectCommentDTO,
} from "@/types/academics/student-academic-profile";

export type AcademicCommentsConductField = {
  key: "conduct" | "interest" | "attitude";
  label: string;
  value: string;
};

export type AcademicCommentsTextBlock = {
  kind: "class_teacher" | "headteacher" | "internal";
  label: string;
  value: string;
};

export type AcademicCommentsSectionModel = {
  sourceLabel: string;
  isOfficialSnapshot: boolean;
  showLiveNotice: boolean;
  conductFields: AcademicCommentsConductField[];
  textBlocks: AcademicCommentsTextBlock[];
  subjectComments: AcademicProfileSubjectCommentDTO[];
  totalEntries: number;
  hasContent: boolean;
  emptyMessage: string;
};

function trimComment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function profileCommentsHasContent(comments: AcademicProfileCommentsDTO) {
  return (
    comments.subjectComments.length > 0 ||
    !!trimComment(comments.classTeacherComment) ||
    !!trimComment(comments.headteacherComment) ||
    !!trimComment(comments.conduct) ||
    !!trimComment(comments.interest) ||
    !!trimComment(comments.attitude) ||
    !!trimComment(comments.internalNotes)
  );
}

export function buildAcademicCommentsSectionModel(input: {
  comments: AcademicProfileCommentsDTO;
  isReleased: boolean;
  dataSource: string;
  canViewInternalNotes?: boolean;
}): AcademicCommentsSectionModel {
  const { comments, isReleased, dataSource, canViewInternalNotes } = input;

  const conductFields: AcademicCommentsConductField[] = [
    { key: "conduct", label: "Conduct", value: trimComment(comments.conduct) ?? "" },
    { key: "interest", label: "Interest", value: trimComment(comments.interest) ?? "" },
    { key: "attitude", label: "Attitude", value: trimComment(comments.attitude) ?? "" },
  ].filter((field) => field.value);

  const textBlocks: AcademicCommentsTextBlock[] = [];

  const classTeacher = trimComment(comments.classTeacherComment);
  if (classTeacher) {
    textBlocks.push({
      kind: "class_teacher",
      label: "Class teacher comment",
      value: classTeacher,
    });
  }

  const headteacher = trimComment(comments.headteacherComment);
  if (headteacher) {
    textBlocks.push({
      kind: "headteacher",
      label: "Headteacher comment",
      value: headteacher,
    });
  }

  if (canViewInternalNotes) {
    const internal = trimComment(comments.internalNotes);
    if (internal) {
      textBlocks.push({
        kind: "internal",
        label: "Internal notes",
        value: internal,
      });
    }
  }

  const subjectComments = comments.subjectComments.filter((entry) =>
    trimComment(entry.comment)
  );

  const totalEntries =
    subjectComments.length + textBlocks.length + conductFields.length;

  const isOfficialSnapshot =
    isReleased || dataSource === "report_snapshot";

  return {
    sourceLabel: isOfficialSnapshot
      ? "Official report-card comments"
      : dataSource === "subject_results"
        ? "Live subject and report comments"
        : dataSource === "legacy"
          ? "Legacy teacher comments"
          : "Comments",
    isOfficialSnapshot,
    showLiveNotice: !isReleased && dataSource !== "report_snapshot" && totalEntries > 0,
    conductFields,
    textBlocks,
    subjectComments,
    totalEntries,
    hasContent: totalEntries > 0,
    emptyMessage: isReleased
      ? "No comments were captured on the released report card for this period."
      : "No teacher or report comments have been recorded for this period yet.",
  };
}
