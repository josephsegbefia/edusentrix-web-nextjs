// src/types/admin/teacher.ts
export type TeacherStatus = "active" | "inactive" | "on_leave" | "terminated";

export type TeacherSubjectDTO = { id: string; name: string };
export type TeacherHomeroomDTO = {
  id: string;
  name: string;
  gradeName?: string | null;
  label?: string | null;
} | null;

export type TeacherEmergencyContactDTO = {
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
};

export type TeacherQualificationDTO = {
  type: "degree" | "certification" | "license" | "other";
  name: string;
  institution: string;
  year: number;
  documentUrl?: string | null;
};

export type TeacherDetailDTO = {
  id: string;
  userId: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string | null;
  phone: string | null;
  photoUrl: string | null;

  status: TeacherStatus;

  employeeId: string | null;
  department: string | null;
  hireDate: string | null;
  terminationDate: string | null;
  leaveStartDate?: string | null;
  leaveEndDate?: string | null;
  leaveReason?: string | null;

  maxClasses: number | null;
  maxStudents: number | null;

  emergencyContact: TeacherEmergencyContactDTO | null;
  qualifications: TeacherQualificationDTO[];

  tags: string[];
  notes: string | null;

  subjects: TeacherSubjectDTO[];
  assignedSubjects?: Array<{ id: string; name: string; classGroups: string[] }>;
  homeroom: TeacherHomeroomDTO;

  createdAt: string;
  updatedAt: string;
  isNew: boolean;
  /** False until they accept the invite and Clerk links their account (clerkUserId set). */
  hasPlatformAccount: boolean;
};

export type TeacherDetailResponse = {
  success: true;
  data: TeacherDetailDTO;
};

// List item type for teachers table/cards
export type TeacherListItemDTO = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: TeacherStatus;
  employeeId: string | null;
  department: string | null;
  subjects: TeacherSubjectDTO[];
  homeroom: TeacherHomeroomDTO;
  hireDate: string | null;
  createdAt: string;
  isNew: boolean;
  leaveStartDate?: string | null;
  leaveEndDate?: string | null;
  leaveReason?: string | null;
  /** False until they accept the invite and Clerk links their account (clerkUserId set). */
  hasPlatformAccount: boolean;
};

// API response types
export type TeacherListResponse = {
  success: true;
  data: TeacherListItemDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type TeacherQuickStatsData = {
  total: number;
  active: number;
  inactive: number;
  homeroom: number;
  onLeave?: number;
  terminated?: number;
};

export type TeacherQuickStatsResponse = {
  success: true;
  data: TeacherQuickStatsData;
};
