// src/types/admin/teacher.ts
export type TeacherStatus = "active" | "inactive" | "on_leave" | "terminated";

export type TeacherSubjectMini = { id: string; name: string };
export type TeacherHomeroomMini = { id: string; name: string };

export type TeacherListItem = {
  id: string;
  userId: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string | null;
  phone: string | null;
  photoUrl: string | null;

  status: TeacherStatus;

  subjects: TeacherSubjectMini[];
  homeroom: TeacherHomeroomMini | null;

  createdAt: string;
  isNew: boolean;
};

export type TeacherListResponse = {
  success: boolean;
  data: TeacherListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type TeacherQuickStats = {
  total: number;
  active: number;
  inactive: number;
  homeroom: number;
};

export type TeacherQuickStatsResponse = {
  success: boolean;
  data: TeacherQuickStats;
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
  subjects: TeacherSubjectMini[];
  homeroom: TeacherHomeroomMini | null;

  // room for future expansion (qualifications, notes, etc.)
  createdAt: string;
  updatedAt: string;
};

export type TeacherDetailResponse = {
  success: boolean;
  data: TeacherDetailDTO;
};
