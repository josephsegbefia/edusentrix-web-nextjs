// src/types/admin/teacher.ts

export type TeacherStatus = "active" | "inactive" | "on_leave" | "terminated";

export type TeacherSubjectDTO = { id: string; name: string };
export type TeacherHomeroomDTO = { id: string; name: string } | null;

export type TeacherListItemDTO = {
  id: string;
  userId: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string | null;
  phone: string | null;
  photoUrl: string | null;

  status: TeacherStatus;

  // professional details
  employeeId: string | null;
  department: string | null;
  hireDate: Date | null;
  terminationDate: Date | null;

  subjects: TeacherSubjectDTO[];
  homeroom: TeacherHomeroomDTO;

  createdAt: string;
  isNew: boolean;
};

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

export type TeacherDetailDTO = TeacherListItemDTO & {
  updatedAt?: string | null;
};

export type TeacherDetailResponse = {
  success: true;
  data: TeacherDetailDTO;
};

export type TeacherQuickStatsResponse = {
  success: true;
  data: {
    total: number;
    active: number;
    inactive: number;
    homeroom: number;
  };
};
