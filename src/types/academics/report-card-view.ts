export type ReportCardViewScoreComponent = {
  key: string;
  label: string;
  order: number;
};

export type ReportCardViewSubjectComponentScore = {
  componentKey: string;
  label: string;
  weightedScore: number;
  rawScore: number;
  rawMaxScore: number;
  rawPercentage: number;
};

export type ReportCardViewSubjectRow = {
  subjectId?: string;
  subjectName: string;
  componentScores: ReportCardViewSubjectComponentScore[];
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint?: number | null;
  descriptor?: string | null;
  isPassed: boolean;
  subjectRemark?: string | null;
  subjectPosition?: number | null;
};

export type ReportCardViewAttendance = {
  ready: boolean;
  totalSchoolDays?: number;
  daysPresent?: number;
  daysAbsent?: number;
  daysLate?: number;
  daysExcused?: number;
  attendancePercentage?: number;
  message?: string;
};

export type ReportCardViewComments = {
  ready: boolean;
  homeroomComment?: string | null;
  headteacherComment?: string | null;
};

export type ReportCardViewGradeBoundary = {
  gradeLabel: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint?: number | null;
  descriptor?: string | null;
};

export type ReportCardViewSection = {
  type: string;
  label: string;
  enabled: boolean;
  order: number;
};

export type ReportCardViewData = {
  source: "snapshot" | "legacy";
  studentReportCardId?: string | null;
  status?: string | null;
  school: {
    name: string;
    logo?: string | null;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    motto?: string | null;
  };
  student: {
    name: string;
    admissionNo?: string | null;
    photoUrl?: string | null;
  };
  grade: { name: string } | null;
  classGroup: { name: string; label?: string | null } | null;
  period: { yearLabel: string; term: string };
  scoreComponents: ReportCardViewScoreComponent[];
  subjects: ReportCardViewSubjectRow[];
  summary: {
    subjectCount: number;
    passedSubjectCount: number;
    averageFinalScore: number;
    classPosition?: number | null;
    totalStudents?: number | null;
  } | null;
  attendance: ReportCardViewAttendance | null;
  comments: ReportCardViewComments | null;
  gradingPolicy: {
    name: string;
    gradeBoundaries: ReportCardViewGradeBoundary[];
    showGradeKey: boolean;
  } | null;
  template: {
    name: string;
    sections: ReportCardViewSection[];
    showClassPosition: boolean;
    showAttendance: boolean;
    showConduct: boolean;
    showGradingKey: boolean;
    orientation?: string;
    paperSize?: string;
  };
  verificationId?: string | null;
  releasedAt?: string | Date | null;
};
