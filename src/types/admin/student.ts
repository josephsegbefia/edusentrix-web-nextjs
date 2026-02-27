export type StudentStatus = "active" | "inactive" | "withdrawn" | "graduated";
export type FeeStatus = "none" | "cleared" | "owing" | "partial" | "unknown"; // unknown is a placeholder until fees system is wired

export type AcademicBadge =
  | "top_1_percent"
  | "top_5_percent"
  | "top_10_percent"
  | "honours"
  | "none";

export type StudentListItem = {
  id: string;
  admissionNumber: string | null;
  firstName: string;
  middleName: string;
  fullName: string;
  sex: "male" | "female";
  photoUrl: string | null;

  gradeId: string | null;
  gradeName: string | null;
  classGroupId: string | null;
  classGroupName: string | null;

  status: StudentStatus;
  enrolledAt: string | null;
  createdAt: string;

  // Fee relates placeholders
  feeStatus: FeeStatus;
  amountOwed: number | null;
  lastPaymentAt: string | null;

  academicBadge: AcademicBadge;
  latestAverage: number | null;
  isTopPerformer: boolean;

  // convenience flags
  isNew: boolean;
};

export type StudentListResponse = {
  success: boolean;
  data: StudentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type StudentQuickStats = {
  total: number;
  owingCount: number;
  owingAmount: number;
  topPerformers: number;
  newThisMonth: number;
  gradeDistribution: {
    gradeId: string;
    gradeName: string;
    count: number;
  }[];
  // Keep classDistribution for backward compatibility (can be removed later)
  classDistribution?: {
    classGroupId: string;
    classGroupName: string;
    gradeId: string | null;
    gradeName: string | null;
    count: number;
  }[];
};

export type StudentDetailDTO = {
  // For now: raw student + resolved grade/class
  // We'll  extend this later with accounts, academics, incidents, etc

  id: string;
  admissionNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  sex: "male" | "female";
  dateOfBirth: string | null;
  photoUrl: string | null;

  gradeId: string | null;
  gradeName: string | null;
  classGroupId: string | null;
  classGroupName: string | null;

  status: StudentStatus;
  enrolledAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Placeholders for future relations (Fee, Academics, Incidents, etc)
  feeStatus: FeeStatus;
  amountOwed: number;
  latestAverage: number | null;
  academicBadge: AcademicBadge;
};
