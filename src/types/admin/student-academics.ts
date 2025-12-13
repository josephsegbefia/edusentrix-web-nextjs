// src/types/admin/student-academics.ts

export type StudentTermPerformanceTier =
  | "top"
  | "above_average"
  | "average"
  | "at_risk";

export type StudentTermTrend = "up" | "down" | "stable";

export type StudentTermSummaryDTO = {
  academicPeriodId: string;
  label: string; // e.g. "2025 / Term 2"
  averageScore: number | null;
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: StudentTermPerformanceTier | null;
};

export type StudentAcademicSubjectDTO = {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  teacherId: string | null;
  teacherName: string | null;

  caScore: number | null;
  caMaxScore: number | null;
  caPercentage: number | null;

  examScore: number | null;
  examMaxScore: number | null;
  examPercentage: number | null;

  totalScore: number | null;
  gradeLetter: string | null;
  gradePoint: number | null;
  isPassed: boolean | null;
};

export type StudentTeacherCommentType =
  | "subject"
  | "general"
  | "promotion"
  | "behavior";

export type StudentTeacherCommentDTO = {
  id: string;
  academicPeriodId: string;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  commentType: StudentTeacherCommentType;
  comment: string;
  isPublic: boolean;
  createdAt: string;
};

export type StudentAcademicsSummaryDTO = {
  overallAverage: number | null;
  classPosition: number | null;
  totalStudents: number | null;
  performanceTier: StudentTermPerformanceTier | null;
  trend: StudentTermTrend;
  trendDelta: number | null;
};

export type StudentTermOverview = {
  termId: string;
  label: string;
  averageScore: number | null;
  classPosition: number | null;
  totalSubjects: number | null;
  performanceTier: StudentTermPerformanceTier | null;
};

export type StudentSubjectPerformanceRow = {
  subjectId: string;
  subjectName: string;
  shortCode: string | null;
  teacherName: string | null;
  caPercentage: number | null;
  examPercentage: number | null;
  totalScore: number | null;
  gradeLetter: string | null;
  gradePoint: number | null;
  isPassed: boolean | null;
};

export type TeacherCommentDTO = {
  id: string;
  commentType: StudentTeacherCommentType;
  subjectId: string | null;
  subjectName: string | null;
  teacherName: string | null;
  comment: string;
  isPublic: boolean;
  createdAt: string;
};

export type RiskLevel = "low" | "medium" | "high";

export type StudentAcademicsDTO = {
  studentId: string;
  selectedTermId: string | null;
  selectedTermLabel: string | null;
  summary: StudentAcademicsSummaryDTO;
  term: StudentTermOverview[];
  subjects: StudentSubjectPerformanceRow[];
  comments: TeacherCommentDTO[];
  // Extended fields for enhanced gradebook
  classAverages?: Record<string, number>; // subjectId -> class average
  multiTermHistory?: Array<{
    termId: string;
    label: string;
    averageScore: number | null;
    classAverage: number | null;
  }>;
  subjectHistory?: Record<
    string,
    Array<{
      termId: string;
      termLabel: string;
      totalScore: number | null;
    }>
  >;
  riskLevel?: RiskLevel;
  strongestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
  weakestSubject?: {
    subjectId: string;
    subjectName: string;
    score: number;
  } | null;
};

export type StudentAcademicsResponse = {
  success: boolean;
  data: StudentAcademicsDTO;
};
